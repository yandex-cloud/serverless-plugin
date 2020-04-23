'use strict';

module.exports = class ObjectStorage {
    constructor(serverless, initial) {
        this.serverless = serverless;
        this.initialState = initial;
        this.newState = null;
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
            await provider.createS3Bucket({name: this.newState.name});
            this.serverless.cli.log(`S3 bucket created "${this.newState.name}"`);
        } catch (e) {
            this.serverless.cli.log(`${e}
      Failed to create S3 bucket "${this.newState.name}"`);
        }
    }
};
