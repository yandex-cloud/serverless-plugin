import Serverless, { FunctionDefinition } from 'serverless';
import ServerlessPlugin from 'serverless/classes/Plugin';

import { Trigger } from '../entities/trigger';
import { YandexCloudProvider } from '../provider/provider';
import {
    FunctionInfo, MessageQueueInfo, S3BucketInfo, ServiceAccountInfo, TriggerInfo,
} from '../types/common';

export class YandexCloudRemove implements ServerlessPlugin {
    private readonly serverless: Serverless;
    private readonly options: Serverless.Options;
    private readonly provider: YandexCloudProvider;

    hooks: ServerlessPlugin.Hooks;

    private existingQueues: MessageQueueInfo[] | undefined = undefined;
    private existingBuckets: S3BucketInfo[] | undefined = undefined;

    constructor(serverless: Serverless, options: Serverless.Options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('yandex-cloud') as YandexCloudProvider;

        this.hooks = {
            'remove:remove': async () => {
                await this.remove();
            },
        };
    }

    async removeFunction(describedFunctionName: string, existingFunctions: FunctionInfo[]) {
        const functionFound = existingFunctions.find((func) => func.name === describedFunctionName);

        if (functionFound) {
            await this.provider.removeFunction(functionFound.id);

            this.serverless.cli.log(`Function "${describedFunctionName}" removed`);
        } else {
            this.serverless.cli.log(`Function "${describedFunctionName}" not found`);
        }
    }

    async removeTrigger(describedTriggerName: string, existingTriggers: TriggerInfo[]) {
        const triggerFound = existingTriggers.find((trigger) => trigger.name === describedTriggerName);

        if (triggerFound) {
            await this.provider.removeTrigger(triggerFound.id);

            this.serverless.cli.log(`Trigger "${describedTriggerName}" removed`);
        } else {
            this.serverless.cli.log(`Trigger "${describedTriggerName}" not found`);
        }
    }

    async removeServiceAccount(describedSaName: string, existingAccounts: ServiceAccountInfo[]) {
        const accFound = existingAccounts.find((acc) => acc.name === describedSaName);

        if (accFound) {
            await this.provider.removeServiceAccount(accFound.id);

            this.serverless.cli.log(`Service account "${describedSaName}" removed`);
        } else {
            this.serverless.cli.log(`Service account "${describedSaName}" not found`);
        }
    }

    async removeMessageQueue(describesQueueName: string, existingQueues: MessageQueueInfo[]) {
        const found = existingQueues.find((q) => q.name === describesQueueName);

        if (found) {
            await this.provider.removeMessageQueue(found.url);
            this.serverless.cli.log(`Message queue "${describesQueueName}" removed`);
        } else {
            this.serverless.cli.log(`Message queue "${describesQueueName}" not found`);
        }
    }

    async removeS3Bucket(describesBucketName: string, existingBuckets: S3BucketInfo[]) {
        const found = existingBuckets.find((b) => b.name === describesBucketName);

        if (found) {
            await this.provider.removeS3Bucket(describesBucketName);
            this.serverless.cli.log(`S3 bucket "${describesBucketName}" removed`);
        } else {
            this.serverless.cli.log(`S3 bucket "${describesBucketName}" not found`);
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

    async remove() {
        const existingFunctions = await this.provider.getFunctions();
        const existingTriggers = await this.provider.getTriggers();
        const describedFunctions = this.serverless.service.functions;
        const existingAccounts = await this.provider.getServiceAccounts();

        for (const descFunc of Object.values(describedFunctions)) {
            for (const triggerType of Trigger.supportedTriggers()) {
                // @ts-ignore
                if (descFunc.events.some((e) => e[triggerType])) {
                    this.removeTrigger(`${descFunc.name}-${triggerType}`, existingTriggers);
                }
            }

            if (descFunc.name) {
                this.removeFunction(descFunc.name, existingFunctions);
            }
        }
        for (const [name, params] of Object.entries(this.serverless.service.resources || [])) {
            try {
                // eslint-disable-next-line default-case
                switch (params.type) {
                    case 'yc::MessageQueue':
                        this.removeMessageQueue(name, await this.getMessageQueuesCached());
                        break;
                    case 'yc::ObjectStorageBucket':
                        this.removeS3Bucket(name, await this.getS3BucketsCached());
                        break;
                }
            } catch (error) {
                this.serverless.cli.log(`${error} Maybe you should set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY environment variables`);
            }
        }

        for (const [name, params] of Object.entries(this.serverless.service.resources || [])) {
            if (params.type === 'yc::ServiceAccount') {
                this.removeServiceAccount(name, existingAccounts);
            }
        }
    }
}
