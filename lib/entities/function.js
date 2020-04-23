'use strict';

module.exports = class Function {
    constructor(serverless, initial) {
        this.serverless = serverless;
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
            name: this.newState.params.name,
            handler: this.newState.params.handler,
            memory: this.newState.params.memory,
            description: this.newState.params.description,
            timeout: this.newState.params.timeout,
            runtime: this.serverless.service.provider.runtime,
            code: this.serverless.service.package.artifact,
            id: this.initialState ? this.initialState.id : null,
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
