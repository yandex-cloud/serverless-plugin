'use strict';

module.exports = class Trigger {
    constructor(serverless, deploy, initial) {
        this.provider = serverless.getProvider('yandex-cloud');
        this.serverless = serverless;
        this.initialState = initial;
        this.deploy = deploy;
        this.newState = null;
        this.create = {
            cron: this.provider.createCronTrigger.bind(this.provider),
            s3: this.provider.createS3Trigger.bind(this.provider),
            ymq: this.provider.createYMQTrigger.bind(this.provider),
        };
    }

    setNewState(newState) {
        this.newState = newState;
    }

    async sync() {
        if (!this.newState) {
            try {
                await this.provider.removeTrigger(this.initialState.id);
                this.serverless.cli.log(`Trigger removed "${this.initialState.name}"`);
            } catch (e) {
                this.serverless.cli.log(`${e}
        Failed to remove trigger "${this.initialState.name}"`);
            }
            return;
        }

        if (this.initialState) {
            try {
                await this.provider.removeTrigger(this.initialState.id);
                this.serverless.cli.log(`Trigger removed "${this.initialState.name}"`);
            } catch (e) {
                this.serverless.cli.log(`${e}
        Failed to remove trigger "${this.initialState.name}"`);
            }
        }

        const triggerName = `${this.newState.function.name}-${this.newState.type}`;
        try {
            const response = await this.create[this.newState.type]({
                name: triggerName,
                queueServiceAccount: this.queueServiceAccount(),
                queueId: this.queueId(),
                functionId: this.deploy.getFunctionId(this.newState.function.name),
                serviceAccount: this.deploy.getServiceAccountId(this.newState.params.account),
                dlqId: this.dlqId(),
                dlqAccountId: this.dlqServiceAccount(),
                ...this.newState.params,
            });
            this.id = response.id;
            this.serverless.cli.log(`Trigger created "${triggerName}"`);
        } catch (e) {
            this.serverless.cli.log(`${e}
      Failed to create trigger "${triggerName}"`);
        }
    }

    queueServiceAccount() {
        return this.newState.type === 'ymq' ? this.deploy.getServiceAccountId(this.newState.params.queueAccount) : undefined;
    }

    queueId() {
        if (this.newState.type !== 'ymq') {
            return;
        }
        if (this.newState.params.queueId) {
            return this.newState.params.queueId;
        }
        return this.deploy.getMessageQueueId(this.newState.params.queue);
    }

    dlqId() {
        if (this.newState.type === 'ymq') {
            return;
        }
        if (this.newState.params.dlqId) {
            return this.newState.params.dlqId;
        }
        return this.deploy.getMessageQueueId(this.newState.params.dlq);
    }

    dlqServiceAccount() {
        if (this.newState.type === 'ymq') {
            return;
        }
        if (this.newState.params.dlqAccountId) {
            return this.newState.params.dlqAccountId;
        }
        return this.deploy.getServiceAccountId(this.newState.params.dlqAccount);
    }

    static supportedTriggers() {
        return ['cron', 's3', 'ymq'];
    }

    static normalizeEvent(event) {
        for (const type of Trigger.supportedTriggers()) {
            if (event[type]) {
                return {type, params: event[type]};
            }
        }
    }
};
