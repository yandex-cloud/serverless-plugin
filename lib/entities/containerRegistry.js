'use strict';

module.exports = class ContainerRegistry {
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
            return;
        }

        try {
            const response = await provider.createContainerRegistry({name: this.newState.name});
            this.id = response.id;
            this.serverless.cli.log(`Container Registry created "${this.newState.name}"`);
        } catch (e) {
            this.serverless.cli.log(`${e}
      Failed to create Container Registry "${this.newState.name}"`);
        }
    }
};
