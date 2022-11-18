import _ from 'lodash';
import { OpenAPIV3 } from 'openapi-types';
import { YandexCloudDeploy } from '../deploy/deploy';
import { ProviderConfig } from '../provider/types';
import {
    HttpMethod,
    HttpMethodAlias,
    HttpMethodAliases,
    HttpMethods,
    IntegrationType,
    PayloadFormatVersion,
    RequestParameters,
    YcOpenAPI3,
    YcPathItemObject,
    YcPathsObject,
} from '../types/common';
import { Event } from '../types/events';
import Serverless from '../types/serverless';
import { YCFunction } from './function';
import OperationObject = OpenAPIV3.OperationObject;
import ParameterObject = OpenAPIV3.ParameterObject;

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

export class OpenApiSpec {
    private spec: YcOpenAPI3;

    constructor(private serverless: Serverless, private deploy: YandexCloudDeploy, title: string, functions: YCFunction[]) {
        this.spec = {
            openapi: '3.0.0',
            info: {
                title,
                version: '1.0.0',
            },
            paths: this.addPaths(functions),
        };
    }

    toString() {
        return JSON.stringify(this.toJson());
    }

    toJson() {
        return Object.fromEntries(Object.entries(this.spec)
            .filter((field) => field[1] !== undefined));
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

    toPathItemObject = <T>(func: YCFunction, event: Event): [string, YcPathItemObject<T>] | undefined => {
        if (!event.http || typeof event.http === 'string' || func.id === undefined) {
            return undefined;
        }
        const providerConfig: ProviderConfig | undefined = this.serverless.service?.provider;

        const { http } = event;
        const acc = func.getNewState()?.params.account;
        const serviceAccountId = acc ? this.deploy.getServiceAccountId(acc) : undefined;
        const payloadFormatVersion = http.eventFormat || (providerConfig?.httpApi.payload ?? PayloadFormatVersion.V0);
        const operation: OperationObject<FunctionIntegration> = {
            'x-yc-apigateway-integration': {
                type: IntegrationType.cloud_functions,
                function_id: func.id,
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
    };

    toPathTuples<T>(func: YCFunction): [string, YcPathItemObject<T>][] {
        const events = func.getNewState()?.params.events ?? [];

        return events
            .map((x) => this.toPathItemObject(func, x))
            .filter((x) => notUndefined(x)) as [string, YcPathItemObject<T>][];
    }

    private addPaths(functions: YCFunction[]) {
        const paths: { [path: string]: YcPathsObject } = {};
        const results = _.flatMap(functions, (f) => this.toPathTuples(f));

        for (const [path, pathObj] of results) {
            const currentPathObj = paths[path] ?? {};
            const merged = _.merge(pathObj, currentPathObj);

            if (HttpMethods.ANY in merged && Object.keys(merged).length > 1) {
                throw new Error('\'x-yc-apigateway-any-method\' declared in the same path with other method');
            }
            paths[path] = merged;
        }

        return paths;
    }
}
