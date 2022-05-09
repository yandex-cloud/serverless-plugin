import ServerlessPlugin from 'serverless/classes/Plugin';
import Serverless from 'serverless';

import { YCFunction } from '../entities/function';
import { Trigger } from '../entities/trigger';
import { ServiceAccount } from '../entities/service-account';
import { MessageQueue } from '../entities/message-queue';
import { ObjectStorage } from '../entities/object-storage';
import { ContainerRegistry } from '../entities/container-registry';
import { YandexCloudProvider } from '../provider/provider';
import { ServerlessFunc } from '../types/common';
import { ApiGateway } from '../entities/api-gateway';
import { log, progress } from '../utils/logging';
import { ProviderConfig } from '../provider/types';

const functionOption = 'function';

export class YandexCloudDeploy implements ServerlessPlugin {
    hooks: ServerlessPlugin.Hooks;
    commands?: ServerlessPlugin.Commands | undefined;
    variableResolvers?: ServerlessPlugin.VariableResolvers | undefined;
    private readonly serverless: Serverless;
    private readonly options: Serverless.Options;
    private readonly apiGatewayRegistry: Record<string, ApiGateway>;
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
        this.apiGatewayRegistry = {};
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

                    log.info('Service deployed successfully');
                } catch (error: any) {
                    log.error(error);
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
        const progressReporter = progress.create({
            name: `deploy`,
        });
        progressReporter.update(`Fetching functions`);
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

        progressReporter.update(`Fetching triggers`);
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

        progressReporter.update(`Fetching service accounts`);
        for (const sa of await this.provider.getServiceAccounts()) {
            this.serviceAccountRegistry[sa.name] = new ServiceAccount(this.serverless, sa);
        }
        for (const [name, params] of Object.entries(this.serverless.service.resources || [])) {
            if (!params.type || params.type !== 'yc::ServiceAccount') {
                continue;
            }

            if (name in this.serviceAccountRegistry) {
                this.serviceAccountRegistry[name].setNewState({ name, ...params });
            } else {
                this.serviceAccountRegistry[name] = new ServiceAccount(this.serverless);
                this.serviceAccountRegistry[name].setNewState({ name, ...params });
            }
        }

        progressReporter.update(`Fetching container registries`);
        for (const r of await this.provider.getContainerRegistries()) {
            this.containerRegistryRegistry[r.name] = new ContainerRegistry(this.serverless, r);
        }
        for (const [name, params] of Object.entries(this.serverless.service.resources || [])) {
            if (!params.type || params.type !== 'yc::ContainerRegistry') {
                continue;
            }

            if (name in this.containerRegistryRegistry) {
                this.containerRegistryRegistry[name].setNewState({
                    name,
                    // params
                });
            } else {
                this.containerRegistryRegistry[name] = new ContainerRegistry(this.serverless);
                this.containerRegistryRegistry[name].setNewState({
                    name,
                    // params
                });
            }
        }

        try {
            const ymqResources = Object.entries(this.serverless.service.resources)
                .filter(([name, params]) => params.type === 'yc::MessageQueue');
            const s3Resouces = Object.entries(this.serverless.service.resources)
                .filter(([name, params]) => params.type === 'yc::ObjectStorageBucket');

            if (ymqResources.length > 0) {
                progressReporter.update(`Fetching queues`);

                for (const queue of await this.provider.getMessageQueues()) {
                    this.messageQueueRegistry[queue.name] = new MessageQueue(this.serverless, queue);
                }

                for (const [name, params] of ymqResources) {
                    if (name in this.messageQueueRegistry) {
                        this.messageQueueRegistry[name].setNewState({
                            name,
                            // params,
                        });
                    } else {
                        this.messageQueueRegistry[name] = new MessageQueue(this.serverless);
                        this.messageQueueRegistry[name].setNewState({
                            name,
                            // params,
                        });
                    }
                }
            }

            if (s3Resouces.length > 0) {
                progressReporter.update(`Fetching buckets`);
                for (const bucket of await this.provider.getS3Buckets()) {
                    this.objectStorageRegistry[bucket.name] = new ObjectStorage(this.serverless, bucket);
                }

                for (const [name, params] of s3Resouces) {
                    if (name in this.objectStorageRegistry) {
                        this.objectStorageRegistry[name].setNewState({
                            name,
                            // params,
                        });
                    } else {
                        this.objectStorageRegistry[name] = new ObjectStorage(this.serverless);
                        this.objectStorageRegistry[name].setNewState({
                            name,
                            // params,
                        });
                    }
                }
            }
        } catch (error) {
            log.error(`${error}
      Maybe you should set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY environment variables`);
        }

        progressReporter.update(`Updating entities`);
        for (const resource of [
            ...Object.values(this.serviceAccountRegistry),
            ...Object.values(this.messageQueueRegistry),
            ...Object.values(this.objectStorageRegistry),
            ...Object.values(this.containerRegistryRegistry),
        ]) {
            await resource.sync();
        }

        await Promise.all(Object.values(this.functionRegistry).map(func => func.sync()));
        await Promise.all(Object.values(this.triggerRegistry).map(trigger => trigger.sync()));

        const providerConfig: ProviderConfig = this.serverless.service.provider as any;

        if (providerConfig.httpApi) {
            const apiGatewayInfo = await this.provider.getApiGateway();
            const apiGateway = new ApiGateway(this.serverless, apiGatewayInfo);
            apiGateway.setNewState({functions: Object.values(this.functionRegistry)})
            await apiGateway.sync()
        }
        progressReporter.remove();
    }

    async deploy() {
        return this.deployService(this.getNeedDeployFunctions());
    }
}
