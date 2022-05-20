import { YCFunction } from './function';
import { UpdateApiGatewayRequest } from '../provider/types';
import { YandexCloudProvider } from '../provider/provider';
import {
    log,
    progress,
} from '../utils/logging';
import { OpenApiSpec } from './openapi-spec';
import Serverless from '../types/serverless';
import { YandexCloudDeploy } from '../deploy/deploy';

interface ApiGatewayState {
    id?: string;
    name: string;
    openapiSpec?: string;
}

interface ApiGatewayNewState {
    openapiSpec: string;
}

export class ApiGateway {
    public id?: string;
    private readonly initialState: ApiGatewayState;
    private newState?: ApiGatewayNewState;

    constructor(private serverless: Serverless, private deploy: YandexCloudDeploy, initial: ApiGatewayState) {
        this.initialState = initial;
        this.id = initial?.id;
    }

    setNewState(input: { functions: YCFunction[] }) {
        this.newState = {
            openapiSpec: this.constructOpenApiSpec(input.functions),
        };
    }

    async sync() {
        const provider = this.serverless.getProvider('yandex-cloud') as YandexCloudProvider;

        if (!this.newState) {
            return;
        }
        const progressReporter = progress.create({
            name: `apigw-${this.initialState.name}`,
        });

        if (this.id) {
            const requestParams: UpdateApiGatewayRequest = {
                ...this.initialState,
                ...this.newState,
                id: this.id,
            };

            try {
                progressReporter.update('Updating API Gateway');
                await provider.updateApiGateway(requestParams);
                progressReporter.remove();
                log.success(`ApiGateway updated\n${requestParams.name}`);
            } catch (error) {
                log.error(`${error}\nFailed to update API Gateway ${requestParams.name}`);
            }

            return;
        }

        try {
            const requestParams = {
                ...this.initialState,
                ...this.newState,
            };

            progressReporter.update('Creating API Gateway');
            const response = await provider.createApiGateway(requestParams);

            progressReporter.remove();
            this.id = response.id;
            log.success(`ApiGateway created\n${requestParams.name}`);
        } catch (error) {
            log.error(`${error}\nFailed to create API Gateway "${this.initialState.name}"`);
        }
    }

    private constructOpenApiSpec(functions: YCFunction[]): string {
        const spec = new OpenApiSpec(this.serverless, this.deploy, this.initialState.name, functions);

        return spec.toString();
    }
}
