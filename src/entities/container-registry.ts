import Serverless from 'serverless';

import { YandexCloudProvider } from '../provider/provider';

interface ContainerRegistryState {
    id?: string;
    name: string;
    // TODO: specify type
    params?: unknown;
}

export class ContainerRegistry {
    private readonly serverless: Serverless;
    private readonly initialState?: ContainerRegistryState;

    private newState?: ContainerRegistryState;

    public id?: string;

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

        try {
            const response = await provider.createContainerRegistry({ name: this.newState.name });

            this.id = response.id;
            this.serverless.cli.log(`Container Registry created "${this.newState.name}"`);
        } catch (error) {
            this.serverless.cli.log(`${error}
      Failed to create Container Registry "${this.newState.name}"`);
        }
    }
}
