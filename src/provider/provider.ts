import {
    cloudApi,
    decodeMessage,
    serviceClients,
    Session,
    waitForOperation,
    WrappedServiceClientType,
} from '@yandex-cloud/nodejs-sdk';
import { Any } from '@yandex-cloud/nodejs-sdk/dist/generated/google/protobuf/any';
import { Status } from '@yandex-cloud/nodejs-sdk/dist/generated/google/rpc/status';
import { Operation } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/operation/operation';
import { GetOpenapiSpecResponse } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/apigateway/v1/apigateway_service';
import { Package } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/functions/v1/function';
import AWS, { S3 } from 'aws-sdk';
import axios from 'axios';
import bind from 'bind-decorator';
import * as lodash from 'lodash';
import _ from 'lodash';
import type ServerlessAwsProviderType from 'serverless/aws';
import ServerlessPlugin from 'serverless/classes/Plugin';

// @ts-ignore TODO: fix @types/serverless and remove this ignore
import ServerlessAwsProvider from 'serverless/lib/plugins/aws/provider';
import yaml from 'yaml';

import {
    ApiGatewayInfo,
    FunctionInfo,
    MessageQueueInfo,
    S3BucketInfo,
    ServiceAccountInfo,
    TriggerInfo,
} from '../types/common';
import { S3Event } from '../types/events';
import Serverless from '../types/serverless';
import { getEnv } from '../utils/get-env';
import {
    log,
    ProgressReporter,
} from '../utils/logging';
import { getYcConfig } from '../utils/yc-config';
import { fileToBase64 } from './helpers';
import {
    CreateApiGatewayRequest,
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
    UpdateApiGatewayRequest,
    UpdateFunctionRequest,
} from './types';

const PROVIDER_NAME = 'yandex-cloud';

const {
    containerregistry: { registry_service: CloudApiRegistryService },
    lockbox: { payload_service: CloudApiLockboxPayloadService },
    serverless: {
        apigateway_service: CloudApiApiGatewayService,
        functions_function_service: CloudApiFunctionsService,
        triggers_trigger_service: CloudApiTriggersService,
        triggers_trigger: CloudApiTriggers,
    },
    iam: { service_account_service: CloudApiServiceAccountService },
    access: { access: CloudApiAccess },
} = cloudApi;

const AwsProvider = ServerlessAwsProvider as typeof ServerlessAwsProviderType;

type SuccessfulOperation = Operation & { response: Any };
type FailedOperation = Operation & { response: undefined; error: Status };

export class YandexCloudProvider implements ServerlessPlugin {
    hooks: ServerlessPlugin.Hooks;
    commands?: ServerlessPlugin.Commands | undefined;
    variableResolvers?: ServerlessPlugin.VariableResolvers | undefined;
    private readonly serverless: Serverless;
    private readonly options: Serverless.Options;
    private session: Session;
    private folderId: string;
    private cloudId: string;
    private triggers: WrappedServiceClientType<typeof serviceClients.TriggerServiceClient.service>;
    private serviceAccounts: WrappedServiceClientType<typeof serviceClients.ServiceAccountServiceClient.service>;
    private apiGateways: WrappedServiceClientType<typeof serviceClients.ApiGatewayServiceClient.service>;
    private functions: WrappedServiceClientType<typeof serviceClients.FunctionServiceClient.service>;
    private folders: WrappedServiceClientType<typeof serviceClients.FolderServiceClient.service>;
    private containerRegistryService: WrappedServiceClientType<typeof serviceClients.RegistryServiceClient.service>;
    private lockboxPayloadService: WrappedServiceClientType<typeof serviceClients.PayloadServiceClient.service>;
    private ymq: AWS.SQS;
    private s3: AWS.S3;

    constructor(serverless: Serverless, options: Serverless.Options) {
        this.serverless = serverless;
        this.options = options;
        this.serverless.setProvider(PROVIDER_NAME, this);
        this.hooks = {};

        // Init YC API client
        const config = getYcConfig();

        const sessionConfig = 'token' in config ? {
            oauthToken: config.token,
        } : {
            iamToken: config.iamToken,
        };

        this.session = new Session(sessionConfig);
        this.folderId = config.folderId;
        this.cloudId = config.cloudId;

        this.apiGateways = this.session.client(serviceClients.ApiGatewayServiceClient);
        this.triggers = this.session.client(serviceClients.TriggerServiceClient);
        this.serviceAccounts = this.session.client(serviceClients.ServiceAccountServiceClient);
        this.functions = this.session.client(serviceClients.FunctionServiceClient);
        this.folders = this.session.client(serviceClients.FolderServiceClient);
        this.containerRegistryService = this.session.client(serviceClients.RegistryServiceClient);
        this.lockboxPayloadService = this.session.client(serviceClients.PayloadServiceClient);

        // Init AWS SDK
        const awsConfig = {
            region: 'ru-central1',
            accessKeyId: getEnv('AWS_ACCESS_KEY_ID'),
            secretAccessKey: getEnv('AWS_SECRET_ACCESS_KEY'),
        };

        this.ymq = new AWS.SQS({
            endpoint: 'https://message-queue.api.cloud.yandex.net',
            ...awsConfig,
        });
        this.s3 = new AWS.S3({
            endpoint: 'https://storage.yandexcloud.net',
            ...awsConfig,
        });
    }

    static getProviderName() {
        return PROVIDER_NAME;
    }

    getValues(source: object, objectPaths: string[][]) {
        return objectPaths.map((objectPath) => ({
            path: objectPath,
            value: _.get(source, objectPath.join('.')),
        }));
    }

    firstValue(values: { value: unknown }[]) {
        return values.reduce(
            (result, current) => (result.value ? result : current),
            {} as { value: unknown },
        );
    }

    getStageSourceValue() {
        const values = this.getValues(this, [
            ['options', 'stage'],
            ['serverless', 'config', 'stage'],
            ['serverless', 'service', 'provider', 'stage'],
        ]);

        return this.firstValue(values);
    }

    getStage() {
        const defaultStage = 'dev';
        const stageSourceValue = this.getStageSourceValue();

        return stageSourceValue.value || defaultStage;
    }

    getServerlessDeploymentBucketName(): string {
        return `serverless-${this.folderId}`;
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

        return this.check(operation);
    }

    convertS3EvenType(type: string) {
        return {
            [S3Event.CREATE]: CloudApiTriggers.Trigger_ObjectStorageEventType.OBJECT_STORAGE_EVENT_TYPE_CREATE_OBJECT,
            [S3Event.DELETE]: CloudApiTriggers.Trigger_ObjectStorageEventType.OBJECT_STORAGE_EVENT_TYPE_DELETE_OBJECT,
            [S3Event.UPDATE]: CloudApiTriggers.Trigger_ObjectStorageEventType.OBJECT_STORAGE_EVENT_TYPE_UPDATE_OBJECT,
        }[type];
    }

    @bind
    async createS3Trigger(request: CreateS3TriggerRequest) {
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

        return this.check(operation);
    }

    @bind
    async createYMQTrigger(request: CreateYmqTriggerRequest) {
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

        return this.check(operation);
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

        return this.check(operation);
    }

    async removeTrigger(id: string) {
        const operation = await this.triggers.delete(CloudApiTriggersService.DeleteTriggerRequest.fromPartial({
            triggerId: id,
        }));

        return this.check(operation);
    }

    async getTriggers(): Promise<TriggerInfo[]> {
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

    async updateAccessBindings(saId: string, roles: string[]): Promise<Operation | undefined> {
        if (!roles || roles.length === 0) {
            return undefined;
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

        return this.check(operation);
    }

    async createServiceAccount(request: CreateServiceAccountRequest) {
        const operation = await this.serviceAccounts.create(CloudApiServiceAccountService.CreateServiceAccountRequest.fromPartial({
            folderId: this.folderId,
            name: request.name,
        }));
        const successfulOperation = await this.check(operation);
        const sa = decodeMessage<cloudApi.iam.service_account.ServiceAccount>(successfulOperation.response);

        await this.updateAccessBindings(sa.id, request.roles);

        return sa;
    }

    async removeServiceAccount(id: string) {
        return this.serviceAccounts.delete(CloudApiServiceAccountService.DeleteServiceAccountRequest.fromPartial({
            serviceAccountId: id,
        }));
    }

    async createApiGateway(request: CreateApiGatewayRequest) {
        log.debug(yaml.stringify(JSON.parse(request.openapiSpec)));
        const operation = await this.apiGateways.create(CloudApiApiGatewayService.CreateApiGatewayRequest.fromPartial({
            name: request.name,
            folderId: this.folderId,
            openapiSpec: request.openapiSpec,
            // description: request.description,
        }));

        const successfulOperation = await this.check(operation);

        const apigw = decodeMessage<cloudApi.serverless.apigateway.ApiGateway>(successfulOperation.response);

        return {
            id: apigw.id,
            name: request.name,
            openapiSpec: request.openapiSpec,
        };
    }

    async updateApiGateway(request: UpdateApiGatewayRequest) {
        const operation = await this.apiGateways.update(CloudApiApiGatewayService.UpdateApiGatewayRequest.fromPartial({
            apiGatewayId: request.id,
            openapiSpec: request.openapiSpec,
            updateMask: {
                paths: [
                    'openapi_spec',
                ],
            },
        }));

        const successfulOperation = await this.check(operation);

        const apigw = decodeMessage<cloudApi.serverless.apigateway.ApiGateway>(successfulOperation.response);

        request.id = apigw.id;

        return request;
    }

    async removeApiGateway(id: string) {
        const operation = await this.apiGateways.delete(CloudApiApiGatewayService.DeleteApiGatewayRequest.fromPartial({
            apiGatewayId: id,
        }));

        return this.check(operation);
    }

    async getApiGateway(): Promise<ApiGatewayInfo> {
        type ListApiGatewayResponse = cloudApi.serverless.apigateway_service.ListApiGatewayResponse;
        const name = `${this.serverless.service.getServiceName()}-${this.getStage()}`;
        const listResponse: ListApiGatewayResponse = await this.apiGateways.list(
            CloudApiApiGatewayService.ListApiGatewayRequest.fromPartial({
                folderId: this.folderId,
                filter: `name = "${name}"`,
            }),
        );

        if (listResponse.apiGateways.length > 0) {
            const apiGateway = listResponse.apiGateways[0];
            const specResponse: GetOpenapiSpecResponse = await this.apiGateways.getOpenapiSpec(
                CloudApiApiGatewayService.GetOpenapiSpecRequest.fromPartial({
                    apiGatewayId: apiGateway.id,
                }),
            );

            return {
                name: apiGateway.name,
                id: apiGateway.id,
                domains: apiGateway.attachedDomains,
                openapiSpec: specResponse.openapiSpec,
            };
        }

        return {
            name,
        };
    }

    async removeFunction(id: string) {
        const operation = await this.functions.delete(CloudApiFunctionsService.DeleteFunctionRequest.fromPartial({
            functionId: id,
        }));

        return waitForOperation(operation, this.session);
    }

    async invokeFunction(id: string) {
        const fn = await this.functions.get(CloudApiFunctionsService.GetFunctionRequest.fromPartial({
            functionId: id,
        }));
        const response = await axios.get(fn.httpInvokeUrl);

        return response.data;
    }

    async getFunctions(): Promise<FunctionInfo[]> {
        const result: FunctionInfo[] = [];

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

    async updateFunction(request: UpdateFunctionRequest, progress?: ProgressReporter) {
        const createVersionRequest: any = {
            functionId: request.id,
            runtime: request.runtime,
            entrypoint: request.handler,
            resources: { memory: request.memorySize && (request.memorySize * 1024 * 1024) },
            executionTimeout: {
                seconds: request.timeout,
            },
            serviceAccountId: request.serviceAccount,
            environment: request.environment,
        };

        if ('code' in request.artifact) {
            createVersionRequest.content = Buffer.from(fileToBase64(request.artifact.code), 'base64');
        } else {
            createVersionRequest.package = request.artifact.package as Package;
        }

        progress?.update(`Creating new version of function '${request.name}'`);
        const operation = await this.functions.createVersion(
            CloudApiFunctionsService.CreateFunctionVersionRequest.fromPartial(createVersionRequest),
        );

        return this.check(operation);
    }

    // noinspection JSUnusedLocalSymbols
    async getFunctionLogs(id: string) {
        throw new Error('not implemented');
    }

    async createFunction(request: CreateFunctionRequest, progress?: ProgressReporter) {
        progress?.update(`Creating function '${request.name}'`);
        const operation = await this.functions.create(CloudApiFunctionsService.CreateFunctionRequest.fromPartial({
            name: request.name,
            folderId: this.folderId,
        }));

        const successfulOperation = await this.check(operation);

        const fn = decodeMessage<cloudApi.serverless.functions_function.Function>(successfulOperation.response);

        request.id = fn.id;

        await this.updateFunction(request, progress);

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
                log.warning(`Unable to resolve ID of Message Queue ${url}`);
            }
        }

        return result;
    }

    async createMessageQueue(request: CreateMessageQueueRequest) {
        const createRequest: AWS.SQS.CreateQueueRequest = {
            QueueName: request.name,
        };

        if (request.fifo) {
            createRequest.Attributes = {
                FifoQueue: 'true',
                ContentBasedDeduplication: request.fifoContentDeduplication ? 'true' : 'false',
            };
        }

        const createResponse = await this.ymq.createQueue(createRequest).promise();

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
        return this.ymq.deleteQueue({ QueueUrl: url }).promise();
    }

    async getS3Buckets(): Promise<S3BucketInfo[]> {
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

    async checkS3Bucket(name: string) {
        return this.s3.headBucket({ Bucket: name }).promise();
    }

    async createS3Bucket(request: CreateS3BucketRequest) {
        return this.s3.createBucket({ Bucket: request.name }).promise();
    }

    async removeS3Bucket(name: string) {
        return this.s3.deleteBucket({ Bucket: name }).promise();
    }

    async putS3Object(request: S3.Types.PutObjectRequest) {
        return this.s3.putObject(request).promise();
    }

    async getContainerRegistries() {
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
        const operation = await this.containerRegistryService.create(CloudApiRegistryService.CreateRegistryRequest.fromPartial({
            folderId: this.folderId,
            name: request.name,
        }));

        const successfulOperation = await this.check(operation);

        const data = decodeMessage<cloudApi.containerregistry.registry.Registry>(successfulOperation.response);

        return {
            id: data.id,
            name: request.name,
        };
    }

    async removeContainerRegistry(id: string) {
        const operation = await this.containerRegistryService.delete(CloudApiRegistryService.DeleteRegistryRequest.fromPartial({
            registryId: id,
        }));

        return this.check(operation);
    }

    async getLockboxSecretKey(secretId: string): Promise<Record<string, string | undefined>> {
        const result: Record<string, string | undefined> = {};
        const response = await this.lockboxPayloadService.get(CloudApiLockboxPayloadService.GetPayloadRequest.fromPartial({
            secretId,
        }));

        for (const entry of response.entries) {
            result[entry.key] = entry.textValue;
        }

        return result;
    }

    private async check(operation: Operation): Promise<SuccessfulOperation> {
        try {
            const awaitedOperation = await waitForOperation(operation, this.session);

            return awaitedOperation as SuccessfulOperation;
        } catch (error: any) {
            const errorOperation = error as FailedOperation;

            for (const x of errorOperation.error.details) {
                log.debug(JSON.stringify(x));
            }
            throw new Error(errorOperation.error.message);
        }
    }
}
