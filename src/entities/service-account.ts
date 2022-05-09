import Serverless from 'serverless';

import { YandexCloudProvider } from '../provider/provider';
import { log } from '../utils/logging';

interface ServiceAccountState {
    id?: string;
    roles: string[];
    name: string;
}

export class ServiceAccount {
    public id?: string;
    private readonly serverless: Serverless;
    private readonly initialState?: ServiceAccountState;
    private newState?: ServiceAccountState;

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
                    && this.initialState.roles.length === this.newState?.roles.length
                    && this.initialState.roles.every((ir) => this.newState?.roles.find((nr) => nr === ir)))
                || !this.initialState?.id
            ) {
                return;
            }

            await provider.removeServiceAccount(this.initialState.id);

            log.success(`Service account removed "${this.initialState.name}"`);
        }

        const response = await provider.createServiceAccount({
            name: this.newState.name,
            roles: this.newState?.roles,
        });

        this.id = response?.id;
        log.success(`Service account created\n${this.newState.name}: ${response?.id}`);
    }
}
