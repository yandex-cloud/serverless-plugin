/* eslint-disable import/no-import-module-exports */
import Serverless from 'serverless';

import { YandexCloudProvider } from './provider/provider';
import { YandexCloudDeploy } from './deploy/deploy';
import { YandexCloudRemove } from './remove/remove';
import { YandexCloudInvoke } from './invoke/invoke';
import { YandexCloudInfo } from './info/info';
import { YandexCloudLogs } from './logs/logs';

class YandexCloudServerlessPlugin {
    private readonly serverless: Serverless;
    private readonly options: Serverless.Options;

    constructor(serverless: Serverless, options: Serverless.Options) {
        this.serverless = serverless;
        this.options = options;

        this.serverless.pluginManager.addPlugin(YandexCloudProvider);
        this.serverless.pluginManager.addPlugin(YandexCloudDeploy);
        this.serverless.pluginManager.addPlugin(YandexCloudRemove);
        this.serverless.pluginManager.addPlugin(YandexCloudInvoke);
        this.serverless.pluginManager.addPlugin(YandexCloudInfo);
        this.serverless.pluginManager.addPlugin(YandexCloudLogs);

        this.serverless.configSchemaHandler.defineProvider(YandexCloudProvider.getProviderName(), {
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
    }
}

// eslint-disable-next-line unicorn/prefer-module
module.exports = YandexCloudServerlessPlugin;
