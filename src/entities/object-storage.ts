import Serverless from 'serverless';

import { YandexCloudProvider } from '../provider/provider';
import { log } from '../utils/logging';

interface ObjectStorageState {
    name: string;
}

export class ObjectStorage {
    private readonly serverless: Serverless;
    private readonly initialState?: ObjectStorageState;

    private newState?: ObjectStorageState;

    constructor(serverless: Serverless, initial?: ObjectStorageState) {
        this.serverless = serverless;
        this.initialState = initial;
    }

    setNewState(newState: ObjectStorageState) {
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

        await provider.createS3Bucket({ name: this.newState.name });
        log.success(`S3 bucket created "${this.newState.name}"`);
    }
}
