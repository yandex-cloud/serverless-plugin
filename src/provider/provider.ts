import {
    cloudApi, serviceClients, Session, WrappedServiceClientType, waitForOperation, decodeMessage,
} from 'yandex-cloud';
import Serverless from 'serverless';
import ServerlessPlugin from 'serverless/classes/Plugin';
// @ts-ignore TODO: fix @types/serverless and remove this ignore
import ServerlessAwsProvider from 'serverless/lib/plugins/aws/provider';
import type ServerlessAwsProviderType from 'serverless/aws';
import AWS from 'aws-sdk';
import axios from 'axios';
import * as lodash from 'lodash';
import bind from 'bind-decorator';
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

import {
    FunctionInfo, MessageQueueInfo, S3BucketInfo, ServiceAccountInfo, TriggerInfo,
} from '../types/common';
import { fileToBase64 } from './helpers';
import { getYcConfig } from '../utils/yc-config';

const PROVIDER_NAME = 'yandex-cloud';

const {
    containerregistry: { registry_service: CloudApiRegistryService },
    serverless: {
        functions_function_service: CloudApiFunctionsService,
        triggers_trigger_service: CloudApiTriggersService,
        triggers_trigger: CloudApiTriggers,
    },
    iam: { service_account_service: CloudApiServiceAccountService },
    access: { access: CloudApiAccess },
} = cloudApi;

const AwsProvider = ServerlessAwsProvider as typeof ServerlessAwsProviderType;

export class YandexCloudProvider extends AwsProvider implements ServerlessPlugin {
    hooks: ServerlessPlugin.Hooks;
    commands?: ServerlessPlugin.Commands | undefined;
    variableResolvers?: ServerlessPlugin.VariableResolvers | undefined;

    private readonly serverless: Serverless;
    private readonly options: Serverless.Options;

    // TODO: get rid of non-null assertion
    private session!: Session;
    private folderId!: string;
    private cloudId!: string;
    private triggers!: WrappedServiceClientType<typeof serviceClients.TriggerServiceClient.service>;
    private serviceAccounts!: WrappedServiceClientType<typeof serviceClients.ServiceAccountServiceClient.service>;
    private functions!: WrappedServiceClientType<typeof serviceClients.FunctionServiceClient.service>;
    private folders!: WrappedServiceClientType<typeof serviceClients.FolderServiceClient.service>;
    private containerRegistryService!: WrappedServiceClientType<typeof serviceClients.RegistryServiceClient.service>;
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
        const config = getYcConfig();
        const { token, cloudId, folderId } = config;

        /* if (config.endpoint) {
            await session.setEndpoint(config.endpoint);
        } */

        this.session = new Session({ oauthToken: token });
        this.folderId = folderId;
        this.cloudId = cloudId;

        this.triggers = this.session.client(serviceClients.TriggerServiceClient);
        this.serviceAccounts = this.session.client(serviceClients.ServiceAccountServiceClient);
        this.functions = this.session.client(serviceClients.FunctionServiceClient);
        this.folders = this.session.client(serviceClients.FolderServiceClient);
        this.containerRegistryService = this.session.client(serviceClients.RegistryServiceClient);
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

    makeInvokeFunctionWithRetryParams(request: InvokeFunctionRequest) {
        return {
            functionId: request.functionId,
            serviceAccountId: request.serviceAccount,
            retrySettings: request.retry
                ? {
                    retryAttempts: request.retry.attempts,
                    interval: {
                        seconds: request.retry.interval,
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

    @bind
    async createCronTrigger(request: CreateCronTriggerRequest) {
        await this.initConnectionsIfNeeded();

        const operation = await this.triggers.create(CloudApiTriggersService.CreateTriggerRequest.fromPartial({
            folderId: this.folderId,
            name: request.name,
            rule: {
                timer: {
                    cronExpression: request.expression,
                    invokeFunctionWithRetry: this.makeInvokeFunctionWithRetryParams(request),
                },
            },
        }));

        return waitForOperation(operation, this.session);
    }

    convertS3EvenType(type: string) {
        return {
            'create.object': CloudApiTriggers.Trigger_ObjectStorageEventType.OBJECT_STORAGE_EVENT_TYPE_CREATE_OBJECT,
            'delete.object': CloudApiTriggers.Trigger_ObjectStorageEventType.OBJECT_STORAGE_EVENT_TYPE_DELETE_OBJECT,
            'update.object': CloudApiTriggers.Trigger_ObjectStorageEventType.OBJECT_STORAGE_EVENT_TYPE_UPDATE_OBJECT,
        }[type];
    }

    @bind
    async createS3Trigger(request: CreateS3TriggerRequest) {
        await this.initConnectionsIfNeeded();

        const operation = await this.triggers.create(CloudApiTriggersService.CreateTriggerRequest.fromPartial({
            folderId: this.folderId,
            name: request.name,
            rule: {
                objectStorage: {
                    eventType: lodash.compact(request.events.map((type) => this.convertS3EvenType(type.toLowerCase()))),
                    bucketId: request.bucket,
                    prefix: request.prefix,
                    suffix: request.suffix,
                    invokeFunction: this.makeInvokeFunctionWithRetryParams(request),
                },
            },
        }));

        return waitForOperation(operation, this.session);
    }

    @bind
    async createYMQTrigger(request: CreateYmqTriggerRequest) {
        await this.initConnectionsIfNeeded();

        const operation = await this.triggers.create(CloudApiTriggersService.CreateTriggerRequest.fromPartial({
            folderId: this.folderId,
            name: request.name,
            rule: {
                messageQueue: {
                    queueId: request.queueId,
                    serviceAccountId: request.queueServiceAccount,
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
        }));

        return waitForOperation(operation, this.session);
    }

    convertCREventType(type: string) {
        return {
            'create.image': CloudApiTriggers.Trigger_ContainerRegistryEventType.CONTAINER_REGISTRY_EVENT_TYPE_CREATE_IMAGE,
            'delete.image': CloudApiTriggers.Trigger_ContainerRegistryEventType.CONTAINER_REGISTRY_EVENT_TYPE_DELETE_IMAGE,
            'create.image-tag': CloudApiTriggers.Trigger_ContainerRegistryEventType.CONTAINER_REGISTRY_EVENT_TYPE_CREATE_IMAGE_TAG,
            'delete.image-tag': CloudApiTriggers.Trigger_ContainerRegistryEventType.CONTAINER_REGISTRY_EVENT_TYPE_DELETE_IMAGE_TAG,
        }[type];
    }

    @bind
    async createCRTrigger(request: CreateCrTriggerRequest) {
        await this.initConnectionsIfNeeded();

        const operation = await this.triggers.create(CloudApiTriggersService.CreateTriggerRequest.fromPartial({
            folderId: this.folderId,
            name: request.name,
            rule: {
                containerRegistry: {
                    eventType: lodash.compact(request.events
                        .map((type) => this.convertCREventType(type.toLowerCase()))),
                    registryId: request.registryId,
                    imageName: request.imageName,
                    tag: request.tag,
                    invokeFunction: this.makeInvokeFunctionWithRetryParams(request),
                },
            },
        }));

        return waitForOperation(operation, this.session);
    }

    async removeTrigger(id: string) {
        await this.initConnectionsIfNeeded();

        const operation = await this.triggers.delete(CloudApiTriggersService.DeleteTriggerRequest.fromPartial({
            triggerId: id,
        }));

        return waitForOperation(operation, this.session);
    }

    async getTriggers(): Promise<TriggerInfo[]> {
        await this.initConnectionsIfNeeded();
        const result = [];

        let nextPageToken;

        type ListTriggersResponse = cloudApi.serverless.triggers_trigger_service.ListTriggersResponse;

        do {
            const response: ListTriggersResponse = await this.triggers.list(
                CloudApiTriggersService.ListTriggersRequest.fromPartial({
                    folderId: this.folderId,
                    pageToken: nextPageToken,
                }),
            );

            if (response.triggers) {
                for (const trigger of response.triggers) {
                    result.push({
                        name: trigger.name,
                        id: trigger.id,
                    });
                }
            }

            nextPageToken = response.nextPageToken;
        } while (nextPageToken);

        return result;
    }

    async getServiceAccounts(): Promise<ServiceAccountInfo[]> {
        await this.initConnectionsIfNeeded();
        const access = await this.getAccessBindings();

        const result = [];
        let nextPageToken;

        type ListServiceAccountsResponse = cloudApi.iam.service_account_service.ListServiceAccountsResponse;

        do {
            const response: ListServiceAccountsResponse = await this.serviceAccounts.list(
                CloudApiServiceAccountService.ListServiceAccountsRequest.fromPartial({
                    folderId: this.folderId,
                    pageToken: nextPageToken,
                }),
            );

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

        type ListAccessBindingsResponse = cloudApi.access.access.ListAccessBindingsResponse;

        do {
            const response: ListAccessBindingsResponse = await this.folders.listAccessBindings(
                CloudApiAccess.ListAccessBindingsRequest.fromPartial({
                    resourceId: this.folderId,
                    pageToken: nextPageToken,
                }),
            );

            if (response.accessBindings) {
                for (const access of response.accessBindings) {
                    result.push({
                        role: access.roleId,
                        subjectId: access.subject?.id,
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
                action: CloudApiAccess.AccessBindingAction.ADD,
                accessBinding: {
                    roleId,
                    subject: {
                        id: saId,
                        type: 'serviceAccount',
                    },
                },
            });
        }

        const operation = await this.folders.updateAccessBindings(CloudApiAccess.UpdateAccessBindingsRequest.fromPartial({
            resourceId: this.folderId,
            accessBindingDeltas,
        }));

        await waitForOperation(operation, this.session);
    }

    async createServiceAccount(request: CreateServiceAccountRequest) {
        await this.initConnectionsIfNeeded();

        const operation = await this.serviceAccounts.create(CloudApiServiceAccountService.CreateServiceAccountRequest.fromPartial({
            folderId: this.folderId,
            name: request.name,
        }));
        const response = await waitForOperation(operation, this.session);

        if (!response.response) {
            throw new Error('Service Account create operation returned no result');
        }
        const sa = decodeMessage<cloudApi.iam.service_account.ServiceAccount>(response.response);

        await this.updateAccessBindings(sa.id, request.roles);

        return sa;
    }

    async removeServiceAccount(id: string) {
        await this.initConnectionsIfNeeded();

        return this.serviceAccounts.delete(CloudApiServiceAccountService.DeleteServiceAccountRequest.fromPartial({
            serviceAccountId: id,
        }));
    }

    async removeFunction(id: string) {
        await this.initConnectionsIfNeeded();
        const operation = await this.functions.delete(CloudApiFunctionsService.DeleteFunctionRequest.fromPartial({
            functionId: id,
        }));

        return waitForOperation(operation, this.session);
    }

    async invokeFunction(id: string) {
        await this.initConnectionsIfNeeded();

        const fn = await this.functions.get(CloudApiFunctionsService.GetFunctionRequest.fromPartial({
            functionId: id,
        }));
        const response = await axios.get(fn.httpInvokeUrl);

        return response.data;
    }

    async getFunctions(): Promise<FunctionInfo[]> {
        await this.initConnectionsIfNeeded();

        const result = [];

        let nextPageToken;

        type ListFunctionsResponse = cloudApi.serverless.functions_function_service.ListFunctionsResponse;

        do {
            const listResponse: ListFunctionsResponse = await this.functions.list(
                CloudApiFunctionsService.ListFunctionsRequest.fromPartial({
                    folderId: this.folderId,
                    pageToken: nextPageToken,
                }),
            );

            if (listResponse.functions) {
                for (const func of listResponse.functions) {
                    result.push({
                        name: func.name,
                        id: func.id,
                    });
                }
            }

            nextPageToken = listResponse.nextPageToken;
        } while (nextPageToken);

        return result;
    }

    async updateFunction(request: UpdateFunctionRequest) {
        await this.initConnectionsIfNeeded();

        const createVersionRequest = CloudApiFunctionsService.CreateFunctionVersionRequest.fromPartial({
            functionId: request.id,
            runtime: request.runtime,
            entrypoint: request.handler,
            resources: { memory: request.memorySize && (request.memorySize * 1024 * 1024) },
            executionTimeout: {
                seconds: request.timeout,
            },
            serviceAccountId: request.serviceAccount,
            content: Buffer.from(fileToBase64(request.code), 'base64'),
            environment: request.environment,
        });

        const operation = await this.functions.createVersion(createVersionRequest);

        return waitForOperation(operation, this.session);
    }

    // noinspection JSUnusedLocalSymbols
    async getFunctionLogs(id: string) {
        throw new Error('not implemented');
    }

    async createFunction(request: CreateFunctionRequest) {
        await this.initConnectionsIfNeeded();
        let operation = await this.functions.create(CloudApiFunctionsService.CreateFunctionRequest.fromPartial({
            name: request.name,
            folderId: this.folderId,
        }));

        operation = await waitForOperation(operation, this.session);

        if (!operation.response) {
            throw new Error('Create function operation has no result');
        }

        const fn = decodeMessage<cloudApi.serverless.functions_function.Function>(operation.response);

        request.id = fn.id;

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

    async getMessageQueues(): Promise<MessageQueueInfo[]> {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();
        const response = await this.ymq.listQueues().promise();
        const result = [];

        for (const url of (response.QueueUrls || [])) {
            const mqId = await this.getMessageQueueId(url);

            if (mqId) {
                result.push({
                    id: mqId,
                    name: this.parseQueueName(url),
                    url,
                });
            } else {
                this.serverless.cli.log(`Unable to resolve ID of Message Queue ${url}`);
            }
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

    async getS3Buckets(): Promise<S3BucketInfo[]> {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();

        const result: S3BucketInfo[] = [];
        const response = await this.s3.listBuckets().promise();
        const buckets = response.Buckets || [];

        for (const bucket of buckets) {
            if (bucket.Name) {
                result.push({
                    name: bucket.Name,
                });
            }
        }

        return result;
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

        let nextPageToken: string | undefined;

        do {
            const request = CloudApiRegistryService.ListRegistriesRequest.fromJSON({
                folderId: this.folderId,
                pageToken: nextPageToken,
            });
            const response = await this.containerRegistryService.list(request);

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
        let operation = await this.containerRegistryService.create(CloudApiRegistryService.CreateRegistryRequest.fromPartial({
            folderId: this.folderId,
            name: request.name,
        }));

        operation = await waitForOperation(operation, this.session);

        if (!operation.response) {
            throw new Error('Create registry operation returned no result');
        }

        const data = decodeMessage<cloudApi.containerregistry.registry.Registry>(operation.response);

        return {
            id: data.id,
            name: request.name,
        };
    }

    async removeContainerRegistry(id: string) {
        await this.initConnectionsIfNeeded();

        return this.containerRegistryService.delete(CloudApiRegistryService.DeleteRegistryRequest.fromPartial({
            registryId: id,
        }));
    }
}
