import { YandexCloudProvider } from '../provider/provider';
import { log } from '../utils/logging';
import Serverless from '../types/serverless';

interface ContainerRegistryState {
    id?: string;
    name: string;
}

export class ContainerRegistry {
    public id?: string;
    private readonly serverless: Serverless;
    private readonly initialState?: ContainerRegistryState;
    private newState?: ContainerRegistryState;

    constructor(serverless: Serverless, initial?: ContainerRegistryState) {
        this.serverless = serverless;
        this.initialState = initial;
        this.id = initial?.id;
    }

    setNewState(newState: ContainerRegistryState) {
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

        const response = await provider.createContainerRegistry({ name: this.newState.name });

        this.id = response?.id;
        log.success(`Container Registry created "${this.newState.name}"`);
    }
}
