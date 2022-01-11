import Serverless, { FunctionDefinition } from 'serverless';
import ServerlessPlugin from 'serverless/classes/Plugin';

import { ServiceAccount } from 'yandex-cloud/api/iam/v1';
import { Trigger } from '../entities/trigger';
import { YandexCloudProvider } from '../provider/provider';
import { logger } from '../utils/logger';

interface Entity {
    id?: string;
    name?: string;
}

export class YandexCloudInfo implements ServerlessPlugin {
    private readonly serverless: Serverless;
    private readonly options: Serverless.Options;

    private provider: YandexCloudProvider;
    private existingQueues: { id?: string; name?: string; url: string }[] | undefined = undefined;
    private existingBuckets: { name?: string }[] | undefined = undefined;

    hooks: ServerlessPlugin.Hooks;

    constructor(serverless: Serverless, options: Serverless.Options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('yandex-cloud') as YandexCloudProvider;

        this.hooks = {
            'info:info': async () => {
                try {
                    await this.info();
                } catch (error) {
                    logger.error(error);

                    this.serverless.cli.log('Failed to get state');
                }
            },
        };
    }

    serviceAccountInfo(name: string, params: unknown, currentAccounts: ServiceAccount[]) {
        const acc = currentAccounts.find((item) => item.name === name);

        if (acc) {
            this.serverless.cli.log(`Service account "${name}" created with id "${acc.id}"`);
        } else {
            this.serverless.cli.log(`Service account "${name}" not created`);
        }
    }

    messageQueueInfo(name: string, params: unknown, currentQueues: Entity[]) {
        const queue = currentQueues.find((item) => item.name === name);

        if (queue) {
            this.serverless.cli.log(`Message queue "${name}" created with id "${queue.id}"`);
        } else {
            this.serverless.cli.log(`Message queue "${name}" not created`);
        }
    }

    objectStorageInfo(name: string, params: unknown, currentBuckets: Entity[]) {
        const bucket = currentBuckets.find((item) => item.name === name);

        if (bucket) {
            this.serverless.cli.log(`Object storage bucket "${name}" created`);
        } else {
            this.serverless.cli.log(`Object storage bucket "${name}" not created`);
        }
    }

    triggersInfo(func: string, params: FunctionDefinition, currentTriggers: Entity[]) {
        for (const event of Object.values(params.events || [])) {
            const normalized = Trigger.normalizeEvent(event);

            if (!normalized) {
                continue;
            }

            const triggerName = `${params.name}-${normalized.type}`;
            const trigger = currentTriggers.find((item) => item.name === triggerName);

            if (trigger) {
                this.serverless.cli.log(`Trigger "${triggerName}" for function "${func}" deployed with id "${trigger.id}"`);
            } else {
                this.serverless.cli.log(`Trigger "${triggerName}" for function "${func}" not deployed`);
            }
        }
    }

    functionInfo(name: string, params: FunctionDefinition, currentFunctions: Entity[], currentTriggers: Entity[]) {
        const func = currentFunctions.find((currFunc) => currFunc.name === params.name);

        if (func) {
            this.serverless.cli.log(`Function "${name}" deployed with id "${func.id}"`);
            this.triggersInfo(name, params, currentTriggers);
        } else {
            this.serverless.cli.log(`Function "${name}" not deployed`);
        }
    }
    async getMessageQueuesCached() {
        if (!this.existingQueues) {
            this.existingQueues = await this.provider.getMessageQueues();
        }

        return this.existingQueues;
    }

    async getS3BucketsCached() {
        if (!this.existingBuckets) {
            this.existingBuckets = await this.provider.getS3Buckets();
        }

        return this.existingBuckets;
    }

    async info() {
        const currentFunctions = await this.provider.getFunctions();
        const currentTriggers = await this.provider.getTriggers();
        const currentServiceAccounts = await this.provider.getServiceAccounts();

        for (const [key, value] of Object.entries(this.serverless.service.functions || [])) {
            this.functionInfo(key, value, currentFunctions, currentTriggers);
        }

        for (const [key, value] of Object.entries(this.serverless.service.resources || [])) {
            try {
                // eslint-disable-next-line default-case
                switch (value.type) {
                    case 'yc::MessageQueue':
                        // eslint-disable-next-line no-await-in-loop
                        this.messageQueueInfo(key, value, await this.getMessageQueuesCached());
                        break;
                    case 'yc::ObjectStorageBucket':
                        // eslint-disable-next-line no-await-in-loop
                        this.objectStorageInfo(key, value, await this.getS3BucketsCached());
                        break;
                }
            } catch (error) {
                this.serverless.cli.log(`Failed to get state for "${key}"
        ${error}
        Maybe you should set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY environment variables`);
            }
        }

        for (const [key, value] of Object.entries(this.serverless.service.resources || [])) {
            if (value.type === 'yc::ServiceAccount') {
                // eslint-disable-next-line no-await-in-loop
                await this.serviceAccountInfo(key, value, currentServiceAccounts);
            }
        }
    }
}
