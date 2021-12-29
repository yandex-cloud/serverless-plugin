'use strict';

module.exports = class MessageQueue {
    constructor(serverless, initial) {
        this.serverless = serverless;
        this.initialState = initial;
        this.newState = null;
        this.id = initial ? initial.id : undefined;
        this.url = initial ? initial.url : undefined;
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
            const response = await provider.createMessageQueue({
                name: this.newState.name,
            });
            this.id = response.id;
            this.url = response.url;
            this.serverless.cli.log(`Message queue created
            ${this.newState.name}: ${response.url}`);
        } catch (e) {
            this.serverless.cli.log(`${e}
      Failed to create message queue "${this.newState.name}"`);
        }
    }
};
