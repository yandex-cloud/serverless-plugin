'use strict';

module.exports = class Function {
    constructor(serverless, deploy, initial) {
        this.serverless = serverless;
        this.deploy = deploy;
        this.initialState = initial;
        this.newState = null;
        this.id = initial ? initial.id : undefined;
    }

    setNewState(newState) {
        this.newState = newState;
    }

    async sync() {
        const provider = this.serverless.getProvider('yandex-cloud');
        if (!this.newState) {
            this.serverless.cli.log(`Unknonwn function "${this.initialState.name}" found`);
            return;
        }

        const requestParams = {
            runtime: this.serverless.service.provider.runtime,
            code: this.serverless.service.package.artifact,
            id: this.initialState ? this.initialState.id : null,
            serviceAccount: this.deploy.getServiceAccountId(this.newState.params.account),
            ...this.newState.params,
        };

        if (this.initialState) {
            try {
                await provider.updateFunction(requestParams);
                this.serverless.cli.log(`Function updated
            ${this.newState.name}: ${requestParams.name}`);
            } catch (e) {
                this.serverless.cli.log(`${e}
        Failed to update function
            ${this.newState.name}: ${requestParams.name}`);
            }
            return;
        }
        try {
            const response = await provider.createFunction(requestParams);
            this.id = response.id;
            this.serverless.cli.log(`Function created
            ${this.newState.name}: ${requestParams.name}`);
        } catch (e) {
            this.serverless.cli.log(`${e}
      Failed to create function "${this.newState.name}"`);
        }
    }
};
