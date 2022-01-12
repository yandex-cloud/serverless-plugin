import ServerlessPlugin from 'serverless/classes/Plugin';
import Serverless from 'serverless';
import { pick } from 'lodash';

import { YCFunction } from '../entities/function';
import { Trigger } from '../entities/trigger';
import { ServiceAccount } from '../entities/service-account';
import { MessageQueue } from '../entities/message-queue';
import { ObjectStorage } from '../entities/object-storage';
import { ContainerRegistry } from '../entities/container-registry';
import { YandexCloudProvider } from '../provider/provider';
import { logger } from '../utils/logger';
import { ServerlessFunc } from '../types/common';

const functionOption = 'function';

export class YandexCloudDeploy implements ServerlessPlugin {
    hooks: ServerlessPlugin.Hooks;
    commands?: ServerlessPlugin.Commands | undefined;
    variableResolvers?: ServerlessPlugin.VariableResolvers | undefined;

    private readonly serverless: Serverless;
    private readonly options: Serverless.Options;
    private readonly functionRegistry: Record<string, YCFunction>;
    private readonly triggerRegistry: Record<string, Trigger>;
    private readonly serviceAccountRegistry: Record<string, ServiceAccount>;
    private readonly messageQueueRegistry: Record<string, MessageQueue>;
    private readonly objectStorageRegistry: Record<string, ObjectStorage>;
    private readonly containerRegistryRegistry: Record<string, ContainerRegistry>;
    private provider: YandexCloudProvider;

    constructor(serverless: Serverless, options: Serverless.Options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('yandex-cloud') as YandexCloudProvider;

        this.functionRegistry = {};
        this.triggerRegistry = {};
        this.serviceAccountRegistry = {};
        this.messageQueueRegistry = {};
        this.objectStorageRegistry = {};
        this.containerRegistryRegistry = {};

        this.hooks = {
            'deploy:deploy': async () => {
                try {
                    await this.deploy();

                    this.serverless.cli.log('Service deployed successfully');
                } catch (error) {
                    logger.error(error);
                }
            },
        };
    }

    getFunctionId(name: string) {
        return this.functionRegistry[name] ? this.functionRegistry[name].id : undefined;
    }

    getServiceAccountId(name: string) {
        return this.serviceAccountRegistry[name] ? this.serviceAccountRegistry[name].id : undefined;
    }

    getMessageQueueId(name: string) {
        return this.messageQueueRegistry[name] ? this.messageQueueRegistry[name].id : undefined;
    }

    getContainerRegistryId(name: string) {
        return this.containerRegistryRegistry[name] ? this.containerRegistryRegistry[name].id : undefined;
    }

    getNeedDeployFunctions() {
        const yFunctions = this.serverless.service.functions as unknown as Record<string, ServerlessFunc>;

        return Object.fromEntries(
            Object.entries(yFunctions)
                .filter(([k, _]) => !this.options[functionOption] || this.options[functionOption] === k),
        );
    }

    async deployService(describedFunctions: Record<string, ServerlessFunc>) {
        for (const func of await this.provider.getFunctions()) {
            this.functionRegistry[func.name] = new YCFunction(this.serverless, this, func);
        }
        for (const [name, func] of Object.entries(describedFunctions)) {
            if (func.name && Object.keys(this.functionRegistry).includes(func.name)) {
                this.functionRegistry[func.name].setNewState({
                    params: func,
                    name,
                });
            } else if (func.name) {
                this.functionRegistry[func.name] = new YCFunction(this.serverless, this);
                this.functionRegistry[func.name].setNewState({
                    params: func,
                    name,
                });
            }
        }

        for (const trigger of await this.provider.getTriggers()) {
            const found = Object.values(describedFunctions).find((f) => {
                for (const type of Trigger.supportedTriggers()) {
                    if (trigger.name === `${f.name}-${type}`) {
                        return true;
                    }
                }

                return false;
            });

            if (found) {
                // TODO: remove it after migration to yandex-cloud@2.X
                // @ts-ignore
                this.triggerRegistry[trigger.name] = new Trigger(this.serverless, this, trigger);
            }
        }
        for (const func of Object.values(describedFunctions)) {
            for (const event of Object.values(func.events || [])) {
                const normalized = Trigger.normalizeEvent(event);

                if (!normalized) {
                    continue;
                }

                const triggerName = `${func.name}-${normalized.type}`;

                if (triggerName in this.triggerRegistry) {
                    this.triggerRegistry[triggerName].setNewState({
                        function: func,
                        type: normalized.type,
                        params: normalized.params,
                    });
                } else {
                    this.triggerRegistry[triggerName] = new Trigger(this.serverless, this);
                    this.triggerRegistry[triggerName].setNewState({
                        function: func,
                        type: normalized.type,
                        params: normalized.params,
                    });
                }
            }
        }

        for (const sa of await this.provider.getServiceAccounts()) {
            // TODO: remove it after migration to yandex-cloud@2.X
            // @ts-ignore
            this.serviceAccountRegistry[sa.name] = new ServiceAccount(this.serverless, sa);
        }
        for (const [name, params] of Object.entries(this.serverless.service.resources || [])) {
            if (!params.type || params.type !== 'yc::ServiceAccount') {
                continue;
            }

            if (name in this.serviceAccountRegistry) {
                this.serviceAccountRegistry[name].setNewState({ name, params });
            } else {
                this.serviceAccountRegistry[name] = new ServiceAccount(this.serverless);
                this.serviceAccountRegistry[name].setNewState({ name, params });
            }
        }

        for (const r of await this.provider.getContainerRegistries()) {
            // TODO: remove it after migration to yandex-cloud@2.X
            // @ts-ignore
            this.containerRegistryRegistry[r.name] = new ContainerRegistry(this.serverless, r);
        }
        for (const [name, params] of Object.entries(this.serverless.service.resources || [])) {
            if (!params.type || params.type !== 'yc::ContainerRegistry') {
                continue;
            }

            if (name in this.containerRegistryRegistry) {
                this.containerRegistryRegistry[name].setNewState({ name, params });
            } else {
                this.containerRegistryRegistry[name] = new ContainerRegistry(this.serverless);
                this.containerRegistryRegistry[name].setNewState({ name, params });
            }
        }

        try {
            for (const queue of await this.provider.getMessageQueues()) {
                // TODO: remove it after migration to yandex-cloud@2.X
                // @ts-ignore
                this.messageQueueRegistry[queue.name] = new MessageQueue(this.serverless, queue);
            }
            for (const [name, params] of Object.entries(this.serverless.service.resources || [])) {
                if (!params.type || params.type !== 'yc::MessageQueue') {
                    continue;
                }

                if (name in this.messageQueueRegistry) {
                    this.messageQueueRegistry[name].setNewState({
                        name,
                        params,
                    });
                } else {
                    this.messageQueueRegistry[name] = new MessageQueue(this.serverless);
                    this.messageQueueRegistry[name].setNewState({
                        name,
                        params,
                    });
                }
            }

            for (const bucket of await this.provider.getS3Buckets()) {
                if (bucket.name) {
                    // TODO: remove it after migration to yandex-cloud@2.X
                    // @ts-ignore
                    this.objectStorageRegistry[bucket.name] = new ObjectStorage(this.serverless, bucket);
                }
            }
            for (const [name, params] of Object.entries(this.serverless.service.resources || [])) {
                if (!params.type || params.type !== 'yc::ObjectStorageBucket') {
                    continue;
                }

                if (name in this.objectStorageRegistry) {
                    this.objectStorageRegistry[name].setNewState({
                        name,
                        params,
                    });
                } else {
                    this.objectStorageRegistry[name] = new ObjectStorage(this.serverless);
                    this.objectStorageRegistry[name].setNewState({
                        name,
                        params,
                    });
                }
            }
        } catch (error) {
            this.serverless.cli.log(`${error}
      Maybe you should set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY environment variables`);
        }

        for (const resource of [
            ...Object.values(this.serviceAccountRegistry),
            ...Object.values(this.messageQueueRegistry),
            ...Object.values(this.objectStorageRegistry),
            ...Object.values(this.containerRegistryRegistry),
            ...Object.values(this.functionRegistry),
            ...Object.values(this.triggerRegistry),
        ]) {
            await resource.sync();
        }
    }

    async deploy() {
        const described = this.getNeedDeployFunctions();
        const funcName = this.options[functionOption];

        if (funcName) {
            return this.deployService(pick(described, funcName));
        }

        return this.deployService(described);
    }
}
