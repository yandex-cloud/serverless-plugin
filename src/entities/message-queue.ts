import { YandexCloudProvider } from '../provider/provider';
import { MessageQueueInfo } from '../types/common';
import { log } from '../utils/logging';
import Serverless from '../types/serverless';

interface MessageQueueState {
    id?: string;
    url?: string;
    name: string;
}

export class MessageQueue {
    public id?: string;
    public url?: string;
    private readonly serverless: Serverless;
    private readonly initialState?: MessageQueueInfo;
    private newState?: MessageQueueState;

    constructor(serverless: Serverless, initial?: MessageQueueInfo) {
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

        const response = await provider.createMessageQueue({
            name: this.newState.name,
        });

        this.id = response.id;
        this.url = response.url;
        log.success(`Message queue created\n${this.newState.name}: ${response.url}`);
    }
}
