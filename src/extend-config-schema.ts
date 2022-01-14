import Serverless from 'serverless';

import { YandexCloudProvider } from './provider/provider';
import { TriggerType } from './types/common';

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

    sls.configSchemaHandler.defineFunctionEvent(YandexCloudProvider.getProviderName(), TriggerType.CRON, {
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
    });

    sls.configSchemaHandler.defineFunctionEvent(YandexCloudProvider.getProviderName(), TriggerType.S3, {
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
    });

    sls.configSchemaHandler.defineFunctionEvent(YandexCloudProvider.getProviderName(), TriggerType.YMQ, {
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
    });

    sls.configSchemaHandler.defineFunctionEvent(YandexCloudProvider.getProviderName(), TriggerType.CR, {
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
    });
};
