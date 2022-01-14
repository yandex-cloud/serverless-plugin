import Serverless from 'serverless';
import type { JSONSchema7 } from 'json-schema';

import { YandexCloudProvider } from './provider/provider';
import { TriggerType } from './types/common';

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

const schemaCronS3: JSONSchema7 = {
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

const schemaCronYMQ: JSONSchema7 = {
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

const schemaCronCR: JSONSchema7 = {
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
                    },
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
                    'go114',
                    'go116',
                    'go117',
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
        },

        provider: {
            properties: {
                credentials: { type: 'string' },
                project: { type: 'string' },
                region: { $ref: '#/definitions/cloudFunctionRegion' },
                runtime: { $ref: '#/definitions/cloudFunctionRuntime' }, // Can be overridden by function configuration
                serviceAccountEmail: { type: 'string' }, // Can be overridden by function configuration
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
                serviceAccountEmail: { type: 'string' }, // Override provider configuration
                memorySize: { $ref: '#/definitions/cloudFunctionMemory' }, // Override provider configuration
                timeout: { type: 'string' }, // Override provider configuration
                environment: { $ref: '#/definitions/cloudFunctionEnvironmentVariables' }, // Override provider configuration
                vpc: { type: 'string' }, // Override provider configuration
                labels: { $ref: '#/definitions/resourceManagerLabels' }, // Override provider configuration
                account: { type: 'string' },
            },
        },
    });

    sls.configSchemaHandler.defineTopLevelProperty(
        'resources',
        schemaResources as Record<string, unknown>,
    );

    sls.configSchemaHandler.defineFunctionEvent(
        YandexCloudProvider.getProviderName(),
        TriggerType.CRON,
        schemaCronTrigger as Record<string, unknown>,
    );

    sls.configSchemaHandler.defineFunctionEvent(
        YandexCloudProvider.getProviderName(),
        TriggerType.S3,
        schemaCronS3 as Record<string, unknown>,
    );

    sls.configSchemaHandler.defineFunctionEvent(
        YandexCloudProvider.getProviderName(),
        TriggerType.YMQ,
        schemaCronYMQ as Record<string, unknown>,
    );

    sls.configSchemaHandler.defineFunctionEvent(
        YandexCloudProvider.getProviderName(),
        TriggerType.CR,
        schemaCronCR as Record<string, unknown>,
    );
};
