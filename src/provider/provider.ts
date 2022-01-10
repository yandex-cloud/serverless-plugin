import yc from 'yandex-cloud';
import yaml from 'yaml';
import fs from 'fs';
import path from 'path';
import Serverless from 'serverless';
import ServerlessPlugin from 'serverless/classes/Plugin';
import ServerlessAwsProvider from 'serverless/plugins/aws/provider/awsProvider';
import AWS from 'aws-sdk';
import long from 'long';
import { FunctionService, ListFunctionsResponse } from 'yandex-cloud/api/serverless/functions/v1';
import {
    InvokeFunctionWithRetry,
    ListTriggersResponse,
    Trigger,
    TriggerService,
} from 'yandex-cloud/api/serverless/triggers/v1';
import { ListServiceAccountsResponse, ServiceAccountService } from 'yandex-cloud/api/iam/v1';
import { FolderService } from 'yandex-cloud/api/resourcemanager/v1';
import { AccessBindingAction, ListAccessBindingsResponse } from 'yandex-cloud/api/access';
import { InvokeService } from 'yandex-cloud/lib/serverless/functions/v1/invoke';
import { ListRegistriesResponse, RegistryService } from 'yandex-cloud/api/containerregistry/v1';
import {
    CreateContainerRegistryRequest,
    CreateCronTriggerRequest,
    CreateCrTriggerRequest,
    CreateFunctionRequest,
    CreateMessageQueueRequest,
    CreateS3BucketRequest,
    CreateS3TriggerRequest,
    CreateServiceAccountRequest,
    CreateYmqTriggerRequest,
    InvokeFunctionRequest,
    UpdateFunctionRequest,
} from './types';

import { getEnv } from '../utils/get-env';

import 'yandex-cloud/lib/operation'; // side-effect, patches Operation

const PROVIDER_NAME = 'yandex-cloud';

const readCliConfig = () => {
    const configFile = path.join(getEnv('HOME'), '.config/yandex-cloud/config.yaml');

    let config;

    try {
        config = yaml.parse(fs.readFileSync(configFile, 'utf8'));
    } catch (error) {
        throw new Error(`Failed to read config ${configFile}: ${error}`);
    }

    const { current, profiles } = config;

    if (!current) {
        throw new Error(`Invalid config in ${configFile}: no current profile selected`);
    }

    if (!profiles[current]) {
        throw new Error(`Invalid config in ${configFile}: no profile named ${current} exists`);
    }

    return profiles[current];
};

const fileToBase64 = (filePath: string) => fs.readFileSync(filePath, 'base64');

export class YandexCloudProvider extends ServerlessAwsProvider implements ServerlessPlugin {
    hooks: ServerlessPlugin.Hooks;
    commands?: ServerlessPlugin.Commands | undefined;
    variableResolvers?: ServerlessPlugin.VariableResolvers | undefined;

    private readonly serverless: Serverless;
    private readonly options: Serverless.Options;

    // TODO: get rid of non-null assertion
    private session!: yc.Session;
    private folderId!: string;
    private cloudId!: string;
    private triggers!: TriggerService;
    private serviceAccounts!: ServiceAccountService;
    private functions!: FunctionService;
    private folders!: FolderService;
    private invokeService!: InvokeService;
    private containerRegistryService!: RegistryService;
    private ymq!: AWS.SQS;
    private s3!: AWS.S3;

    static getProviderName() {
        return PROVIDER_NAME;
    }

    constructor(serverless: Serverless, options: Serverless.Options) {
        super(serverless, options);

        this.serverless = serverless;
        this.options = options;
        this.serverless.setProvider(PROVIDER_NAME, this);
        this.hooks = {};
    }

    async initConnectionsIfNeeded() {
        if (this.session) {
            return;
        }
        const config = readCliConfig();
        const session = new yc.Session({ oauthToken: config.token });

        if (config.endpoint) {
            await session.setEndpoint(config.endpoint);
        }

        this.session = session;
        this.folderId = config['folder-id'];
        this.cloudId = config['cloud-id'];

        this.triggers = new TriggerService(this.session);
        this.serviceAccounts = new ServiceAccountService(this.session);
        this.functions = new FunctionService(this.session);
        this.folders = new FolderService(this.session);
        this.invokeService = new InvokeService(this.session);
        this.containerRegistryService = new RegistryService(this.session);
    }

    async initAwsSdkIfNeeded() {
        if (this.ymq) {
            return;
        }
        const config = {
            region: 'ru-central1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        };

        this.ymq = new AWS.SQS({
            endpoint: process.env.YMQ_ENDPOINT ? process.env.YMQ_ENDPOINT : 'https://message-queue.api.cloud.yandex.net',
            ...config,
        });
        this.s3 = new AWS.S3({
            endpoint: process.env.S3_ENDPOINT ? process.env.S3_ENDPOINT : 'https://storage.yandexcloud.net',
            ...config,
        });
    }

    makeInvokeFunctionWithRetryParams(request: InvokeFunctionRequest): InvokeFunctionWithRetry {
        return {
            functionId: request.functionId,
            serviceAccountId: request.serviceAccount,
            retrySettings: request.retry
                ? {
                    retryAttempts: long.fromNumber(request.retry.attempts),
                    interval: {
                        seconds: long.fromNumber(request.retry.interval),
                    },
                }
                : undefined,
            deadLetterQueue: request.dlqId && request.dlqAccountId
                ? {
                    queueId: request.dlqId,
                    serviceAccountId: request.dlqAccountId,
                }
                : undefined,
        };
    }

    async createCronTrigger(request: CreateCronTriggerRequest) {
        await this.initConnectionsIfNeeded();
        const operation = await this.triggers.create({
            folderId: this.folderId,
            name: request.name,
            rule: {
                timer: {
                    cronExpression: request.expression,
                    invokeFunctionWithRetry: this.makeInvokeFunctionWithRetryParams(request),
                },
            },
        });

        return operation.completion(this.session);
    }

    convertS3EvenType(type: string) {
        return {
            'create.object': Trigger.ObjectStorageEventType.OBJECT_STORAGE_EVENT_TYPE_CREATE_OBJECT,
            'delete.object': Trigger.ObjectStorageEventType.OBJECT_STORAGE_EVENT_TYPE_DELETE_OBJECT,
            'update.object': Trigger.ObjectStorageEventType.OBJECT_STORAGE_EVENT_TYPE_UPDATE_OBJECT,
        }[type];
    }

    async createS3Trigger(request: CreateS3TriggerRequest) {
        await this.initConnectionsIfNeeded();

        const operation = await this.triggers.create({
            folderId: this.folderId,
            name: request.name,
            rule: {
                objectStorage: {
                    eventType: request.events.map((type) => this.convertS3EvenType(type.toLowerCase())),
                    bucketId: request.bucket,
                    prefix: request.prefix,
                    suffix: request.suffix,
                    invokeFunction: this.makeInvokeFunctionWithRetryParams(request),
                },
            },
        });

        return operation.completion(this.session);
    }

    async createYMQTrigger(request: CreateYmqTriggerRequest) {
        await this.initConnectionsIfNeeded();
        const operation = await this.triggers.create({
            folderId: this.folderId,
            name: request.name,
            rule: {
                messageQueue: {
                    queueId: request.queueId,
                    serviceAccountId: request.queueServiceAccount,
                    suffix: request.suffix,
                    batchSettings: {
                        size: request.batch,
                        cutoff: { seconds: request.cutoff },
                    },
                    invokeFunction: {
                        functionId: request.functionId,
                        serviceAccountId: request.serviceAccount,
                    },
                },
            },
        });

        return operation.completion(this.session);
    }

    convertCREventType(type: string) {
        return {
            'create.image': Trigger.ContainerRegistryEventType.CONTAINER_REGISTRY_EVENT_TYPE_CREATE_IMAGE,
            'delete.image': Trigger.ContainerRegistryEventType.CONTAINER_REGISTRY_EVENT_TYPE_DELETE_IMAGE,
            'create.image-tag': Trigger.ContainerRegistryEventType.CONTAINER_REGISTRY_EVENT_TYPE_CREATE_IMAGE_TAG,
            'delete.image-tag': Trigger.ContainerRegistryEventType.CONTAINER_REGISTRY_EVENT_TYPE_DELETE_IMAGE_TAG,
        }[type];
    }

    async createCRTrigger(request: CreateCrTriggerRequest) {
        await this.initConnectionsIfNeeded();
        const operation = await this.triggers.create({
            folderId: this.folderId,
            name: request.name,
            rule: {
                containerRegistry: {
                    eventType: request.events.map((type) => this.convertCREventType(type.toLowerCase())),
                    registryId: request.registryId,
                    imageName: request.imageName,
                    tag: request.tag,
                    invokeFunction: this.makeInvokeFunctionWithRetryParams(request),
                },
            },
        });

        return operation.completion(this.session);
    }

    async removeTrigger(id: string) {
        await this.initConnectionsIfNeeded();
        const operation = await this.triggers.delete({ triggerId: id });

        return operation.completion(this.session);
    }

    async getTriggers() {
        await this.initConnectionsIfNeeded();
        const result = [];

        let nextPageToken;

        do {
            // eslint-disable-next-line no-await-in-loop
            const responce: ListTriggersResponse = await this.triggers.list({
                folderId: this.folderId,
                pageToken: nextPageToken,
            });

            if (responce.triggers) {
                for (const trigger of responce.triggers) {
                    result.push({
                        name: trigger.name,
                        id: trigger.id,
                    });
                }
            }

            nextPageToken = responce.nextPageToken;
        } while (nextPageToken);

        return result;
    }

    async getServiceAccounts() {
        await this.initConnectionsIfNeeded();
        const access = await this.getAccessBindings();

        const result = [];
        let nextPageToken;

        do {
            // eslint-disable-next-line no-await-in-loop
            const response: ListServiceAccountsResponse = await this.serviceAccounts.list({
                folderId: this.folderId,
                pageToken: nextPageToken,
            });

            if (response.serviceAccounts) {
                for (const account of response.serviceAccounts) {
                    result.push({
                        name: account.name,
                        id: account.id,
                        roles: access.filter((a) => a.subjectId === account.id).map((a) => a.role),
                    });
                }
            }

            nextPageToken = response.nextPageToken;
        } while (nextPageToken);

        return result;
    }

    async getAccessBindings() {
        await this.initConnectionsIfNeeded();
        const result = [];

        let nextPageToken;

        do {
            // eslint-disable-next-line no-await-in-loop
            const response: ListAccessBindingsResponse = await this.folders.listAccessBindings({
                resourceId: this.folderId,
                pageToken: nextPageToken,
            });

            if (response.accessBindings) {
                for (const access of response.accessBindings) {
                    result.push({
                        role: access.roleId,
                        subjectId: access.subject.id,
                    });
                }
            }

            nextPageToken = response.nextPageToken;
        } while (nextPageToken);

        return result;
    }

    async updateAccessBindings(saId: string, roles: string[]) {
        await this.initConnectionsIfNeeded();

        if (!roles || roles.length === 0) {
            return;
        }

        const accessBindingDeltas = [];

        for (const roleId of Object.values(roles)) {
            accessBindingDeltas.push({
                action: AccessBindingAction.ADD,
                accessBinding: {
                    roleId,
                    subject: {
                        id: saId,
                        type: 'serviceAccount',
                    },
                },
            });
        }

        const operation = await this.folders.updateAccessBindings({
            resourceId: this.folderId,
            accessBindingDeltas,
        });

        await operation.completion(this.session);
    }

    async createServiceAccount(request: CreateServiceAccountRequest) {
        await this.initConnectionsIfNeeded();
        const operation = await this.serviceAccounts.create({
            folderId: this.folderId,
            name: request.name,
        });
        const response = await operation.completion(this.session);

        await this.updateAccessBindings(response.getResponse().id, request.roles);

        return response.getResponse();
    }

    async removeServiceAccount(id: string) {
        await this.initConnectionsIfNeeded();

        return this.serviceAccounts.delete({ serviceAccountId: id });
    }

    async removeFunction(id: string) {
        await this.initConnectionsIfNeeded();
        const operation = await this.functions.delete({
            functionId: id,
        });

        return operation.completion(this.session);
    }

    async invokeFunction(id: string) {
        await this.initConnectionsIfNeeded();

        return this.invokeService.invoke(id);
    }

    async getFunctions() {
        await this.initConnectionsIfNeeded();
        const result = [];

        let nextPageToken;

        do {
            // eslint-disable-next-line no-await-in-loop
            const response: ListFunctionsResponse = await this.functions.list({
                folderId: this.folderId,
                pageToken: nextPageToken,
            });

            if (response.functions) {
                for (const func of response.functions) {
                    result.push({
                        name: func.name,
                        id: func.id,
                    });
                }
            }

            nextPageToken = response.nextPageToken;
        } while (nextPageToken);

        return result;
    }

    async updateFunction(request: UpdateFunctionRequest) {
        await this.initConnectionsIfNeeded();
        const operation = await this.functions.createVersion({
            functionId: request.id,
            runtime: request.runtime,
            entrypoint: request.handler,
            resources: { memory: long.fromNumber(request.memory * 1024 * 1024) },
            executionTimeout: {
                seconds: long.fromNumber(request.timeout),
            },
            serviceAccountId: request.serviceAccount,
            content: Buffer.from(fileToBase64(request.code), 'base64'),
            environment: request.environment,
        });

        return operation.completion(this.session);
    }

    // noinspection JSUnusedLocalSymbols
    async getFunctionLogs(id: string) {
        throw new Error('not implemented');
    }

    async createFunction(request: CreateFunctionRequest) {
        await this.initConnectionsIfNeeded();
        let operation = await this.functions.create({
            name: request.name,
            folderId: this.folderId,
        });

        operation = await operation.completion(this.session);

        request.id = operation.getResponse().id;
        await this.updateFunction(request);

        return request;
    }

    async getMessageQueueId(url: string) {
        const response = await this.ymq
            .getQueueAttributes({
                QueueUrl: url,
                AttributeNames: ['QueueArn'],
            })
            .promise();

        return response.Attributes?.QueueArn;
    }

    parseQueueName(url: string) {
        return url.slice(url.lastIndexOf('/') + 1);
    }

    async getMessageQueues() {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();
        const response = await this.ymq.listQueues().promise();
        const result = [];

        for (const url of (response.QueueUrls || [])) {
            result.push({
                // eslint-disable-next-line no-await-in-loop
                id: await this.getMessageQueueId(url),
                name: this.parseQueueName(url),
                url,
            });
        }

        return result;
    }

    async createMessageQueue(request: CreateMessageQueueRequest) {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();

        const createResponse = await this.ymq.createQueue({ QueueName: request.name }).promise();

        const url = createResponse.QueueUrl;

        if (!url) {
            throw new Error('Unable to get URL of created queue');
        }

        const getAttrsResponse = await this.ymq
            .getQueueAttributes(
                {
                    QueueUrl: url,
                    AttributeNames: ['QueueArn'],
                },
            )
            .promise();

        return {
            name: request.name,
            id: getAttrsResponse.Attributes?.QueueArn,
            url,
        };
    }

    async removeMessageQueue(url: string) {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();

        return this.ymq.deleteQueue({ QueueUrl: url }).promise();
    }

    async getS3Buckets() {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();
        const response = await this.s3.listBuckets().promise();

        return response.Buckets?.map((b) => ({ name: b.Name })) || [];
    }

    async createS3Bucket(request: CreateS3BucketRequest) {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();

        return this.s3.createBucket({ Bucket: request.name }).promise();
    }

    async removeS3Bucket(name: string) {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();

        return this.s3.deleteBucket({ Bucket: name }).promise();
    }

    async getContainerRegistries() {
        await this.initConnectionsIfNeeded();
        const result = [];

        let nextPageToken;

        do {
            // eslint-disable-next-line no-await-in-loop
            const response: ListRegistriesResponse = await this.containerRegistryService.list({
                folderId: this.folderId,
                pageToken: nextPageToken,
            });

            if (response.registries) {
                for (const registry of response.registries) {
                    result.push({
                        name: registry.name,
                        id: registry.id,
                    });
                }
            }

            nextPageToken = response.nextPageToken;
        } while (nextPageToken);

        return result;
    }

    async createContainerRegistry(request: CreateContainerRegistryRequest) {
        await this.initConnectionsIfNeeded();
        let operation = await this.containerRegistryService.create({
            folderId: this.folderId,
            name: request.name,
        });

        operation = await operation.completion(this.session);

        return {
            id: operation.getResponse().id,
            name: request.name,
        };
    }

    async removeContainerRegistry(id: string) {
        await this.initConnectionsIfNeeded();

        return this.containerRegistryService.delete({ registryId: id });
    }
}
