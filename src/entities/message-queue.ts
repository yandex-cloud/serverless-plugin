import Serverless from 'serverless';

import { YandexCloudProvider } from '../provider/provider';

interface MessageQueueState {
    id?: string;
    url?: string;
    name: string;
    // TODO: specify type
    params: unknown;
}

export class MessageQueue {
    private readonly serverless: Serverless;
    private readonly initialState?: MessageQueueState;

    private newState?: MessageQueueState;

    public id?: string;
    public url?: string;

    constructor(serverless: Serverless, initial?: MessageQueueState) {
        this.serverless = serverless;
        this.initialState = initial;
        this.id = initial?.id;
        this.url = initial?.url;
    }

    setNewState(newState: MessageQueueState) {
        this.newState = newState;
    }

    async sync() {
        const provider = this.serverless.getProvider('yandex-cloud') as YandexCloudProvider;

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
            this.serverless.cli.log(`Message queue created\n${this.newState.name}: ${response.url}`);
        } catch (error) {
            this.serverless.cli.log(`${error}\nFailed to create message queue "${this.newState.name}"`);
        }
    }
}
