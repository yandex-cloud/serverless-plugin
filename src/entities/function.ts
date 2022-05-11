import Serverless from 'serverless';
import bind from 'bind-decorator';
import { OpenAPIV3 } from 'openapi-types';
import { log, progress } from '../utils/logging';
import { YandexCloudProvider } from '../provider/provider';
import { YandexCloudDeploy } from '../deploy/deploy';
import {
    Event,
    HttpMethod,
    HttpMethodAlias,
    HttpMethodAliases,
    HttpMethods,
    IntegrationType,
    PayloadFormatVersion,
    RequestParameters,
    ServerlessFunc,
    YcPathItemObject,
} from '../types/common';
import { ProviderConfig } from '../provider/types';
import ParameterObject = OpenAPIV3.ParameterObject;
import OperationObject = OpenAPIV3.OperationObject;

interface FunctionState {
    id: string;
    name: string;
}

interface FunctionNewState {
    params: ServerlessFunc;
    name: string;
}

interface FunctionIntegration {
    'x-yc-apigateway-integration': {
        type: IntegrationType.cloud_functions;
        function_id: string;
        tag: string;
        payload_format_version: string;
        service_account_id?: string
        context?: object
    };
}

const notUndefined = <T>(x: T | undefined): x is T => x !== undefined;

const mapParamGroupToPlacement = (group: keyof RequestParameters): string => {
    switch (group) {
        case 'querystrings':
            return 'query';
        case 'headers':
            return 'header';
        case 'paths':
            return 'path';
        default:
            throw new Error('unexpected value');
    }
};

export class YCFunction {
    public id?: string;
    private readonly serverless: Serverless;
    private readonly deploy: YandexCloudDeploy;
    private readonly initialState?: FunctionState;
    private newState?: FunctionNewState;

    constructor(serverless: Serverless, deploy: YandexCloudDeploy, initial?: FunctionState) {
        this.serverless = serverless;
        this.deploy = deploy;
        this.initialState = initial;
        this.id = initial?.id;
    }

    private static validateEnvironment(environment: Record<string, string> | undefined, provider: YandexCloudProvider) {
        let result = true;

        if (!environment) {
            return result;
        }
        for (const [k, v] of Object.entries(environment)) {
            if (!/^[A-Za-z]\w*$/.test(k)) {
                log.error(`Environment variable "${k}" name does not match with "[a-zA-Z][a-zA-Z0-9_]*"`);
                result = false;
            }
            if (typeof v !== 'string') {
                log.error(`Environment variable "${k}" value is not string`);
                result = false;
                continue;
            }
            if (v.length > 4096) {
                log.error(`Environment variable "${k}" value is too long`);
                result = false;
            }
        }

        return result;
    }

    setNewState(newState: FunctionNewState) {
        this.newState = newState;
    }

    mapMethod(method: HttpMethodAlias): HttpMethod {
        switch (method) {
            case HttpMethodAliases.GET:
                return HttpMethods.GET;
            case HttpMethodAliases.PUT:
                return HttpMethods.PUT;
            case HttpMethodAliases.POST:
                return HttpMethods.POST;
            case HttpMethodAliases.DELETE:
                return HttpMethods.DELETE;
            case HttpMethodAliases.OPTIONS:
                return HttpMethods.OPTIONS;
            case HttpMethodAliases.HEAD:
                return HttpMethods.HEAD;
            case HttpMethodAliases.PATCH:
                return HttpMethods.PATCH;
            case HttpMethodAliases.TRACE:
                return HttpMethods.TRACE;
            case HttpMethodAliases.ANY:
                return HttpMethods.ANY;
            default:
                throw new Error('Unknown method');
        }
    }

    makeParameter(placement: keyof RequestParameters, name: string, required: boolean): ParameterObject {
        return {
            in: mapParamGroupToPlacement(placement),
            name,
            schema: {
                type: 'string',
            },
            required,
        };
    }

    @bind
    toPathItemObject<T>(event: Event): [string, YcPathItemObject<T>] | undefined {
        if (!event.http || typeof event.http === 'string' || this.id === undefined) {
            return undefined;
        }
        const providerConfig: ProviderConfig | undefined = this.serverless.service?.provider as any;

        const { http } = event;
        const serviceAccountId = this.newState?.params.account ? this.deploy.getServiceAccountId(this.newState?.params.account) : undefined;
        const payloadFormatVersion = http.eventFormat || (providerConfig?.httpApi.payload ?? PayloadFormatVersion.V0);
        const operation: OperationObject<FunctionIntegration> = {
            'x-yc-apigateway-integration': {
                type: IntegrationType.cloud_functions,
                function_id: this.id,
                tag: '$latest',
                payload_format_version: payloadFormatVersion,
                service_account_id: serviceAccountId,
                context: http.context,
            },
            responses: {
                200: {
                    description: 'ok',
                },
            },
        };
        const { parameters } = http.request ?? {};

        if (parameters) {
            const constructParams = (key: keyof RequestParameters) => Object.entries(parameters[key] ?? {})
                .map(([name, required]) => this.makeParameter(key, name, required));

            operation.parameters = (['paths', 'querystrings', 'headers'] as const).flatMap((x) => constructParams(x));
        }

        return [http.path,
            {
                [this.mapMethod(http.method)]: operation,
            }];
    }

    @bind
    toPathTuples<T>(): [string, YcPathItemObject<T>][] {
        const events = this.newState?.params.events ?? [];

        return events
            .map((x) => this.toPathItemObject(x))
            .filter((x) => notUndefined(x)) as [string, YcPathItemObject<T>][];
    }

    async sync() {
        const provider = this.serverless.getProvider('yandex-cloud') as YandexCloudProvider;

        if (!this.newState) {
            log.info(`Unknown function "${this.initialState?.name}" found`);

            return;
        }

        if (!YCFunction.validateEnvironment(this.newState.params.environment, provider)) {
            throw new Error('Invalid environment');
        }

        if (!this.serverless.service.provider.runtime) {
            throw new Error('Provider\'s runtime is not defined');
        }

        const progressReporter = progress.create({
            name: `function-${this.newState.name}`,
        });

        if (this.initialState) {
            const requestParams = {
                ...this.newState.params,
                runtime: this.serverless.service.provider.runtime,
                code: this.serverless.service.package.artifact,
                id: this.initialState.id,
                serviceAccount: this.deploy.getServiceAccountId(this.newState.params.account),
            };

            await provider.updateFunction(requestParams, progressReporter);
            progressReporter.remove();

            log.success(`Function updated\n${this.newState.name}: ${requestParams.name}`);

            return;
        }

        const requestParams = {
            ...this.newState.params,
            runtime: this.serverless.service.provider.runtime,
            code: this.serverless.service.package.artifact,
            serviceAccount: this.deploy.getServiceAccountId(this.newState.params.account),
        };
        const response = await provider.createFunction(requestParams, progressReporter);

        progressReporter.remove();

        this.id = response.id;
        log.success(`Function created\n${this.newState.name}: ${requestParams.name}`);
    }
}
