'use strict';

const Trigger = require('../entities/trigger');

class YandexCloudRemove {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('yandex-cloud');

        this.hooks = {
            'remove:remove': async () => {
                await this.remove();
            },
        };
    }

    async removeFunction(describedFunctionName, existingFunctions) {
        const functionFound = existingFunctions.find((func) => func.name === describedFunctionName);
        if (functionFound) {
            await this.provider.removeFunction(functionFound.id);
            this.serverless.cli.log(`Function "${describedFunctionName}" removed`);
        } else {
            this.serverless.cli.log(`Function "${describedFunctionName}" not found`);
        }
    }

    async removeTrigger(describedTriggerName, existingTriggers) {
        const triggerFound = existingTriggers.find((trigger) => trigger.name === describedTriggerName);
        if (triggerFound) {
            await this.provider.removeTrigger(triggerFound.id);
            this.serverless.cli.log(`Trigger "${describedTriggerName}" removed`);
        } else {
            this.serverless.cli.log(`Trigger "${describedTriggerName}" not found`);
        }
    }

    async removeServiceAccount(describedSaName, existingAccounts) {
        const accFound = existingAccounts.find((acc) => acc.name === describedSaName);
        if (accFound) {
            await this.provider.removeServiceAccount(accFound.id);
            this.serverless.cli.log(`Service account "${describedSaName}" removed`);
        } else {
            this.serverless.cli.log(`Service account "${describedSaName}" not found`);
        }
    }

    async removeMessageQueue(describesQueueName, existingQueues) {
        const found = existingQueues.find((q) => q.name === describesQueueName);
        if (found) {
            await this.provider.removeMessageQueue(found.url);
            this.serverless.cli.log(`Message queue "${describesQueueName}" removed`);
        } else {
            this.serverless.cli.log(`Message queue "${describesQueueName}" not found`);
        }
    }

    async removeS3Bucket(describesBucketName, existingBuckets) {
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

        for (const descFunc of Object.values(describedFunctions || [])) {
            for (const triggerType of Trigger.supportedTriggers()) {
                await this.removeTrigger(`${descFunc.name}-${triggerType}`, existingTriggers);
            }
            await this.removeFunction(descFunc.name, existingFunctions);
        }
        for (const [name, params] of Object.entries(this.serverless.service.resources || [])) {
            try {
                switch (params.type) {
                    case 'yc::MessageQueue':
                        await this.removeMessageQueue(name, await this.getMessageQueuesCached());
                        break;
                    case 'yc::ObjectStorageBucket':
                        await this.removeS3Bucket(name, await this.getS3BucketsCached());
                        break;
                }
            } catch (e) {
                this.serverless.cli.log(`${e} Maybe you should set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY environment variables`);
            }
        }

        for (const [name, params] of Object.entries(this.serverless.service.resources || [])) {
            if (params.type === 'yc::ServiceAccount') {
                await this.removeServiceAccount(name, existingAccounts);
            }
        }
    }
}

module.exports = YandexCloudRemove;
