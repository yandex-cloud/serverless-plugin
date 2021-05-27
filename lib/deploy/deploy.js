'use strict';

const YCFunction = require('../entities/function');
const Trigger = require('../entities/trigger');
const ServiceAccount = require('../entities/serviceAccount');
const MessageQueue = require('../entities/messageQueue');
const ObjectStorage = require('../entities/objectStorage');
const ContainerRegistry = require('../entities/containerRegistry');
const ApiGW = require('../entities/apigw');

const DeployResources = require('./resources')

const functionOption = 'function';

module.exports = class YandexCloudDeploy {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('yandex-cloud');
        this.functionRegistry = {};
        this.triggerRegistry = {};
        this.serviceAccountRegistry = {};
        this.messageQueueRegistry = {};
        this.objectStorageRegistry = {};
        this.containerRegistryRegistry = {};
		this.apigwRegistry = {};
		
        this.hooks = {
            'deploy:deploy': async () => {
                try {
                    await this.deploy();
                    this.serverless.cli.log('Service deployed successfully');
                } catch (e) {
                    console.log(e);
                }
            },
        };
    }

    getFunctionId(name) {
        return this.functionRegistry[name] ? this.functionRegistry[name].id : undefined;
    }

    getServiceAccountId(name) {
        return this.serviceAccountRegistry[name] ? this.serviceAccountRegistry[name].id : undefined;
    }

    getMessageQueueId(name) {
        return this.messageQueueRegistry[name] ? this.messageQueueRegistry[name].id : undefined;
    }

    getContainerRegistryId(name) {
        return this.containerRegistryRegistry[name] ? this.containerRegistryRegistry[name].id : undefined;
    }

    getNeedDeployFunctions() {
        return Object.fromEntries(
            Object.entries(this.serverless.service.functions).filter(([k, _]) => !this.options[functionOption] || this.options[functionOption] === k),
        );
    }

    async deployService(describedFunctions) {
		
		const resources = new DeployResources(this.serverless, this.options);
		
		await resources.deploy();
		
        for (const func of await this.provider.getFunctions()) {
            this.functionRegistry[func.name] = new YCFunction(this.serverless, this, func);
        }
        for (const [name, func] of Object.entries(describedFunctions)) {
            if (Object.keys(this.functionRegistry).find((name) => name === func.name)) {
                this.functionRegistry[func.name].setNewState({
                    params: func,
                    name,
                });
            } else {
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
            this.serviceAccountRegistry[sa.name] = new ServiceAccount(this.serverless, sa);
        }
        for (const [name, params] of Object.entries(this.serverless.service.resources || [])) {
            if (!params.type || params.type !== 'yc::ServiceAccount') {
                continue;
            }

            if (name in this.serviceAccountRegistry) {
                this.serviceAccountRegistry[name].setNewState({name, params});
            } else {
                this.serviceAccountRegistry[name] = new ServiceAccount(this.serverless);
                this.serviceAccountRegistry[name].setNewState({name, params});
            }
        }

        for (const r of await this.provider.getContainerRegistries()) {
            this.containerRegistryRegistry[r.name] = new ContainerRegistry(this.serverless, r);
        }
        for (const [name, params] of Object.entries(this.serverless.service.resources || [])) {
            if (!params.type || params.type !== 'yc::ContainerRegistry') {
                continue;
            }

            if (name in this.containerRegistryRegistry) {
                this.containerRegistryRegistry[name].setNewState({name, params});
            } else {
                this.containerRegistryRegistry[name] = new ContainerRegistry(this.serverless);
                this.containerRegistryRegistry[name].setNewState({name, params});
            }
        }

        try {
            for (const queue of await this.provider.getMessageQueues()) {
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
                this.objectStorageRegistry[bucket.name] = new ObjectStorage(this.serverless, bucket);
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
			
			for (const [name, params] of Object.entries(this.serverless.service.resources.apigateways)) {
				this.apigwRegistry[name] = new ApiGW(this.serverless, this);
				this.apigwRegistry[name].setNewState({name, params});
			}
        } catch (e) {
            this.serverless.cli.log(`${e}
      Maybe you should set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY environment variables`);
        }

        for (const resource of [
            ...Object.values(this.serviceAccountRegistry),
            ...Object.values(this.messageQueueRegistry),
            ...Object.values(this.objectStorageRegistry),
            ...Object.values(this.containerRegistryRegistry),
            ...Object.values(this.functionRegistry),
            ...Object.values(this.triggerRegistry),
            ...Object.values(this.apigwRegistry),
        ]) {
            await resource.sync();
        }
    }

    async deploy() {
        const described = this.getNeedDeployFunctions();
        if (this.options[functionOption] && described.length === 1) {
            return this.deployService(described.slice(0, 1));
        }
        return this.deployService(described);
    }
};
