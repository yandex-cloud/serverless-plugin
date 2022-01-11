import Serverless from 'serverless';

import { YandexCloudProvider } from '../provider/provider';
import { YandexCloudDeploy } from '../deploy/deploy';
import { UpdateFunctionRequest } from '../provider/types';

interface FunctionStateParams extends UpdateFunctionRequest {
    name: string;
    account: string;
}

interface FunctionState {
    id?: string;
    name: string;
    params: FunctionStateParams
}

export class YCFunction {
    private readonly serverless: Serverless;
    private readonly deploy: YandexCloudDeploy;
    private readonly initialState?: FunctionState;

    private newState?: FunctionState;

    public id?: string;

    constructor(serverless: Serverless, deploy: YandexCloudDeploy, initial?: FunctionState) {
        this.serverless = serverless;
        this.deploy = deploy;
        this.initialState = initial;
        this.id = initial?.id;
    }

    setNewState(newState: FunctionState) {
        this.newState = newState;
    }

    validateEnvironment(environment?: Record<string, string>) {
        let result = true;

        if (!environment) {
            return result;
        }
        for (const [k, v] of Object.entries(environment)) {
            if (!/^[A-Za-z]\w*$/.test(k)) {
                this.serverless.cli.log(`Environment variable "${k}" name does not match with "[a-zA-Z][a-zA-Z0-9_]*"`);
                result = false;
            }
            if (typeof v !== 'string') {
                this.serverless.cli.log(`Environment variable "${k}" value is not string`);
                result = false;
                continue;
            }
            if (v.length > 4096) {
                this.serverless.cli.log(`Environment variable "${k}" value is too long`);
                result = false;
            }
        }

        return result;
    }

    async sync() {
        const provider = this.serverless.getProvider('yandex-cloud') as YandexCloudProvider;

        if (!this.newState) {
            this.serverless.cli.log(`Unknown function "${this.initialState?.name}" found`);

            return;
        }

        if (!this.validateEnvironment(this.newState.params.environment)) {
            return;
        }

        if (!this.serverless.service.provider.runtime) {
            this.serverless.cli.log('Provider\'s runtime is not defined');

            return;
        }

        if (this.initialState) {
            if (!this.initialState?.id) {
                this.serverless.cli.log('Function id is not defined');

                return;
            }

            const requestParams = {
                ...this.newState.params,
                runtime: this.serverless.service.provider.runtime,
                code: this.serverless.service.package.artifact,
                id: this.initialState?.id,
                serviceAccount: this.deploy.getServiceAccountId(this.newState.params.account),
            };

            try {
                await provider.updateFunction(requestParams);
                this.serverless.cli.log(`Function updated\n${this.newState.name}: ${requestParams.name}`);
            } catch (error) {
                this.serverless.cli.log(`${error}\nFailed to update function
            ${this.newState.name}: ${requestParams.name}`);
            }

            return;
        }

        try {
            const requestParams = {
                ...this.newState.params,
                runtime: this.serverless.service.provider.runtime,
                code: this.serverless.service.package.artifact,
                serviceAccount: this.deploy.getServiceAccountId(this.newState.params.account),
            };
            const response = await provider.createFunction(requestParams);

            this.id = response.id;
            this.serverless.cli.log(`Function created\n${this.newState.name}: ${requestParams.name}`);
        } catch (error) {
            this.serverless.cli.log(`${error}\nFailed to create function "${this.newState.name}"`);
        }
    }
}
