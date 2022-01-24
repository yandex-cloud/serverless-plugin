import Serverless from 'serverless';

import { YandexCloudProvider } from '../provider/provider';

interface ServiceAccountState {
    id?: string;
    roles?: string[];
    name: string;
    params?: {
        roles: string[];
    }
}

export class ServiceAccount {
    private readonly serverless: Serverless;
    private readonly initialState?: ServiceAccountState;

    private newState?: ServiceAccountState;

    public id?: string;

    constructor(serverless: Serverless, initial?: ServiceAccountState) {
        this.serverless = serverless;
        this.initialState = initial;
        this.id = initial?.id;
    }

    setNewState(newState: ServiceAccountState) {
        this.newState = newState;
    }

    async sync() {
        const provider = this.serverless.getProvider('yandex-cloud') as YandexCloudProvider;

        if (!this.newState) {
            return;
        }

        if (this.initialState) {
            if (
                (this.initialState.roles
                && this.initialState.roles.length === this.newState.params?.roles.length
                && this.initialState.roles.every((ir) => this.newState?.params?.roles.find((nr) => nr === ir)))
                || !this.initialState?.id
            ) {
                return;
            }
            try {
                await provider.removeServiceAccount(this.initialState.id);

                this.serverless.cli.log(`Service account removed "${this.initialState.name}"`);
            } catch (error) {
                this.serverless.cli.log(`${error}\nFailed to remove service account "${this.initialState.name}"`);
            }
        }

        try {
            const response = await provider.createServiceAccount({
                name: this.newState.name,
                roles: this.newState.params?.roles,
            });

            this.id = response.id;
            this.serverless.cli.log(`Service account created\n${this.newState.name}: ${response.id}`);
        } catch (error) {
            this.serverless.cli.log(`${error}\nFailed to create service account "${this.newState.name}"`);
        }
    }
}
