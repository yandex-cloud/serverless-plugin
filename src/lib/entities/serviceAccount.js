'use strict';

module.exports = class ServiceAccount {
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
            return;
        }

        if (this.initialState) {
            if (
                this.initialState.roles &&
                this.initialState.roles.length === this.newState.params.roles.length &&
                this.initialState.roles.every((ir) => this.newState.params.roles.find((nr) => nr === ir))
            ) {
                return;
            }
            try {
                await provider.removeServiceAccount(this.initialState.id);
                this.serverless.cli.log(`Service account removed "${this.initialState.name}"`);
            } catch (e) {
                this.serverless.cli.log(`${e}
        Failed to remove service account "${this.initialState.name}"`);
            }
        }

        try {
            const response = await provider.createServiceAccount({
                name: this.newState.name,
                roles: this.newState.params.roles,
            });
            this.id = response.id;
            this.serverless.cli.log(`Service account created
            ${this.newState.name}: ${response.id}`);
        } catch (e) {
            this.serverless.cli.log(`${e}
      Failed to create service account "${this.newState.name}"`);
        }
    }
};
