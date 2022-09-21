import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';

import { YandexCloudProvider } from './provider/provider';
import { EventType, TriggerType } from './types/common';
import Serverless from './types/serverless';

const requestParametersSchema: JSONSchema7 = {
    type: 'object',
    additionalProperties: {
        anyOf: [
            { type: 'boolean' },
        ],
    },
};

const requestSchema: JSONSchema7 = {
    type: 'object',
    properties: {
        parameters: {
            type: 'object',
            properties: {
                querystrings: requestParametersSchema,
                headers: requestParametersSchema,
                paths: requestParametersSchema,
            },
            additionalProperties: false,
        },
        // schemas: {
        //     type: 'object',
        //     additionalProperties: { anyOf: [{ type: 'object' }, { type: 'string' }] },
        // },
    },
    additionalProperties: false,
};

const responseSchema: JSONSchema7 = {
    type: 'object',
    properties: {
        headers: {
            type: 'object',
            additionalProperties: { type: 'string' },
        },
        template: { type: 'string' },
        statusCodes: {
            type: 'object',
            propertyNames: {
                type: 'string',
                pattern: '^\\d{3}$',
            },
            additionalProperties: {
                type: 'object',
                properties: {
                    headers: {
                        type: 'object',
                        additionalProperties: { type: 'string' },
                    },
                    pattern: { type: 'string' },
                    template: {
                        anyOf: [
                            { type: 'string' },
                            {
                                type: 'object',
                                additionalProperties: { type: 'string' },
                            },
                        ],
                    },
                },
                additionalProperties: false,
            },
        },
    },
    additionalProperties: false,
};

const schemaHttpTrigger: JSONSchema7 = {
    type: 'object',
    properties: {
        path: { type: 'string' },
        method: {
            enum: [
                'get',
                'put',
                'post',
                'delete',
                'options',
                'head',
                'patch',
                'trace',
                'any',
            ],
        },
        authorizer: { type: 'string' },
        eventFormat: {
            enum: ['1.0', '0.1'],
        },
        context: {
            type: 'object',
        },
        request: requestSchema,
        // response: responseSchema,
    },
    required: ['path', 'method'],
};

const schemaCronTrigger: JSONSchema7 = {
    type: 'object',
    properties: {
        expression: { type: 'string' },
        account: { type: 'string' },
        retry: {
            type: 'object',
            properties: {
                attempts: { type: 'number' },
                interval: { type: 'number' },
            },
        },
        dlq: { type: 'string' },
        dlqId: { type: 'string' },
        dlqAccountId: { type: 'string' },
        dlqAccount: { type: 'string' },
    },
    required: ['expression', 'account'],
};

const schemaS3Trigger: JSONSchema7 = {
    type: 'object',
    properties: {
        bucket: { type: 'string' },
        account: { type: 'string' },
        events: {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        prefix: { type: 'string' },
        suffix: { type: 'string' },
        retry: {
            type: 'object',
            properties: {
                attempts: { type: 'number' },
                interval: { type: 'number' },
            },
        },
        dlq: { type: 'string' },
        dlqId: { type: 'string' },
        dlqAccountId: { type: 'string' },
        dlqAccount: { type: 'string' },
    },
    required: ['bucket', 'account', 'events'],
};

const schemaYMQTrigger: JSONSchema7 = {
    type: 'object',
    properties: {
        queue: { type: 'string' },
        queueId: { type: 'string' },
        queueAccount: { type: 'string' },
        account: { type: 'string' },
        retry: {
            type: 'object',
            properties: {
                attempts: { type: 'number' },
                interval: { type: 'number' },
            },
        },
    },
    required: ['queue', 'account', 'queueAccount'],
};

const schemaCRTrigger: JSONSchema7 = {
    type: 'object',
    properties: {
        registry: { type: 'string' },
        registryId: { type: 'string' },
        imageName: { type: 'string' },
        tag: { type: 'string' },
        events: {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        account: { type: 'string' },
        retry: {
            type: 'object',
            properties: {
                attempts: { type: 'number' },
                interval: { type: 'number' },
            },
        },
        dlq: { type: 'string' },
        dlqId: { type: 'string' },
        dlqAccountId: { type: 'string' },
        dlqAccount: { type: 'string' },
    },
    required: ['events', 'account', 'imageName', 'tag', 'registry'],
};

const schemaResources: JSONSchema7 = {
    type: 'object',
    patternProperties: {
        '^.*$': {
            oneOf: [
                {
                    type: 'object',
                    properties: {
                        type: {
                            enum: ['yc::ServiceAccount'],
                        },
                        roles: {
                            type: 'array',
                            items: {
                                type: 'string',
                            },
                        },
                    },
                },
                {
                    type: 'object',
                    properties: {
                        type: {
                            enum: ['yc::MessageQueue'],
                        },
                        name: { type: 'string' },
                        fifo: { type: 'boolean' },
                        fifoContentDeduplication: { type: 'boolean' },
                    },
                    required: ['name'],
                },
                {
                    type: 'object',
                    properties: {
                        type: {
                            enum: ['yc::ObjectStorageBucket'],
                        },
                        name: { type: 'string' },
                    },
                },
                {
                    type: 'object',
                    properties: {
                        type: {
                            enum: ['yc::ContainerRegistry'],
                        },
                        name: { type: 'string' },
                    },
                },
            ],
        },
    },
};

export const extendConfigSchema = (sls: Serverless) => {
    sls.configSchemaHandler.defineProvider(YandexCloudProvider.getProviderName(), {
        definitions: {
            cloudFunctionRegion: {
                enum: [
                    'ru-central1',
                ],
            },
            cloudFunctionRuntime: {
                // Source: https://cloud.google.com/functions/docs/concepts/exec#runtimes
                enum: [
                    'nodejs10',
                    'nodejs12',
                    'nodejs14',
                    'nodejs16',
                    'python27',
                    'python37',
                    'python38',
                    'python39',
                    'golang114',
                    'golang116',
                    'golang117',
                    'java11',
                    'dotnet31',
                    'bash',
                    'php74',
                    'php8',
                    'r4.0.2',
                ],
            },
            cloudFunctionMemory: {
                type: 'number',
            },
            cloudFunctionEnvironmentVariables: {
                type: 'object',
                patternProperties: {
                    '^.*$': { type: 'string' },
                },
                additionalProperties: false,
            },
            resourceManagerLabels: {
                type: 'object',
                propertyNames: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 63,
                },
                patternProperties: {
                    '^[a-z][a-z0-9_.]*$': { type: 'string' },
                },
                additionalProperties: false,
            },
            apiKeyFunctionAuthorizer: {
                type: 'object',
                properties: {
                    type: { enum: ['apiKey'] },
                    in: { enum: ['header', 'query', 'cookie'] },
                    name: { type: 'string' },
                    function: { type: 'string' },
                },
                required: ['type', 'in', 'name', 'function'],
            },
            httpFunctionAuthorizer: {
                type: 'object',
                properties: {
                    type: { enum: ['http'] },
                    scheme: { enum: ['bearer'] },
                    function: { type: 'string' },
                    bearerFormat: { type: 'string' },
                },
                required: ['type', 'scheme', 'function'],
            },
            functionAuthorizer: {
                type: 'object',
                oneOf: [
                    {
                        $ref: '#/definitions/apiKeyFunctionAuthorizer',
                    },
                    {
                        $ref: '#/definitions/httpFunctionAuthorizer',
                    },
                ],
            },
            authorizers: {
                type: 'object',
                patternProperties: {
                    '^[a-z][a-z0-9_.]*$': { $ref: '#/definitions/functionAuthorizer' },
                },
            },
            apiGatewayConfig: {
                type: 'object',
                properties: {
                    payload: {
                        enum: [
                            '0.1',
                            '1.0',
                        ],
                    },
                    authorizers: { $ref: '#/definitions/authorizers' },
                },
            },
        },
        provider: {
            properties: {
                credentials: { type: 'string' },
                project: { type: 'string' },
                region: { $ref: '#/definitions/cloudFunctionRegion' },
                httpApi: { $ref: '#/definitions/apiGatewayConfig' },
                runtime: { $ref: '#/definitions/cloudFunctionRuntime' }, // Can be overridden by function configuration
                memorySize: { $ref: '#/definitions/cloudFunctionMemory' }, // Can be overridden by function configuration
                timeout: { type: 'string' }, // Can be overridden by function configuration
                environment: { $ref: '#/definitions/cloudFunctionEnvironmentVariables' }, // Can be overridden by function configuration
                vpc: { type: 'string' }, // Can be overridden by function configuration
                labels: { $ref: '#/definitions/resourceManagerLabels' }, // Can be overridden by function configuration
            },
        },
        function: {
            properties: {
                handler: { type: 'string' },
                runtime: { $ref: '#/definitions/cloudFunctionRuntime' }, // Override provider configuration
                memorySize: { $ref: '#/definitions/cloudFunctionMemory' }, // Override provider configuration
                timeout: { type: 'string' }, // Override provider configuration
                environment: { $ref: '#/definitions/cloudFunctionEnvironmentVariables' }, // Override provider configuration
                vpc: { type: 'string' }, // Override provider configuration
                labels: { $ref: '#/definitions/resourceManagerLabels' }, // Override provider configuration
                account: { type: 'string' },
                package: {
                    type: 'object',
                    properties: {
                        artifact: { type: 'string' },
                        exclude: { type: 'array', items: { type: 'string' } },
                        include: { type: 'array', items: { type: 'string' } },
                        individually: { type: 'boolean' },
                        patterns: { type: 'array', items: { type: 'string' } },
                    },
                    additionalProperties: false,
                },
            },
        },
    });

    sls.configSchemaHandler.defineTopLevelProperty(
        'resources',
        schemaResources as Record<string, unknown>,
    );

    sls.configSchemaHandler.defineFunctionEvent(
        YandexCloudProvider.getProviderName(),
        EventType.HTTP,
        schemaHttpTrigger as Record<string, unknown>,
    );

    sls.configSchemaHandler.defineFunctionEvent(
        YandexCloudProvider.getProviderName(),
        TriggerType.CRON,
        schemaCronTrigger as Record<string, unknown>,
    );

    sls.configSchemaHandler.defineFunctionEvent(
        YandexCloudProvider.getProviderName(),
        TriggerType.S3,
        schemaS3Trigger as Record<string, unknown>,
    );

    sls.configSchemaHandler.defineFunctionEvent(
        YandexCloudProvider.getProviderName(),
        TriggerType.YMQ,
        schemaYMQTrigger as Record<string, unknown>,
    );

    sls.configSchemaHandler.defineFunctionEvent(
        YandexCloudProvider.getProviderName(),
        TriggerType.CR,
        schemaCRTrigger as Record<string, unknown>,
    );
};
