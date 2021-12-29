'use strict';

const Trigger = require('../entities/trigger');

class YandexCloudInfo {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('yandex-cloud');

        this.hooks = {
            'info:info': async () => {
                try {
                    await this.info();
                } catch (e) {
                    console.log(e);
                    this.serverless.cli.log('Failed to get state');
                }
            },
        };
    }

    serviceAccountInfo(name, params, currentAccounts) {
        const acc = currentAccounts.find((acc) => {
            return acc.name === name;
        });
        if (acc) {
            this.serverless.cli.log(`Service account "${name}" created with id "${acc.id}"`);
        } else {
            this.serverless.cli.log(`Service account "${name}" not created`);
        }
    }

    messageQueueInfo(name, params, currentQueues) {
        const queue = currentQueues.find((queue) => {
            return queue.name === name;
        });
        if (queue) {
            this.serverless.cli.log(`Message queue "${name}" created with id "${queue.id}"`);
        } else {
            this.serverless.cli.log(`Message queue "${name}" not created`);
        }
    }

    objectStorageInfo(name, params, currentBuckets) {
        const bucket = currentBuckets.find((bucket) => {
            return bucket.name === name;
        });
        if (bucket) {
            this.serverless.cli.log(`Object storage bucket "${name}" created`);
        } else {
            this.serverless.cli.log(`Object storage bucket "${name}" not created`);
        }
    }

    triggersInfo(func, params, currentTriggers) {
        for (const event of Object.values(params.events || [])) {
            const normalized = Trigger.normalizeEvent(event);
            if (!normalized) {
                continue;
            }

            const triggerName = `${params.name}-${normalized.type}`;
            const trigger = currentTriggers.find((trigger) => {
                return trigger.name === triggerName;
            });
            if (trigger) {
                this.serverless.cli.log(`Trigger "${triggerName}" for function "${func}" deployed with id "${trigger.id}"`);
            } else {
                this.serverless.cli.log(`Trigger "${triggerName}" for function "${func}" not deployed`);
            }
        }
    }

    functionInfo(name, params, currentFunctions, currentTriggers) {
        const func = currentFunctions.find((currFunc) => {
            return currFunc.name === params.name;
        });
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
                switch (value.type) {
                    case 'yc::MessageQueue':
                        this.messageQueueInfo(key, value, await this.getMessageQueuesCached());
                        break;
                    case 'yc::ObjectStorageBucket':
                        this.objectStorageInfo(key, value, await this.getS3BucketsCached());
                        break;
                }
            } catch (e) {
                this.serverless.cli.log(`Failed to get state for "${key}"
        ${e}
        Maybe you should set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY environment variables`);
            }
        }

        for (const [key, value] of Object.entries(this.serverless.service.resources || [])) {
            if (value.type === 'yc::ServiceAccount') {
                await this.serviceAccountInfo(key, value, currentServiceAccounts);
            }
        }
    }
}

module.exports = YandexCloudInfo;
