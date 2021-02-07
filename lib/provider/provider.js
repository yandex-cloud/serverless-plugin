'use strict';

const PROVIDER_NAME = 'yandex-cloud';

const yc = require('yandex-cloud');
const yaml = require('yaml');
const fs = require('fs');
const path = require('path');

const AWS = require('aws-sdk');

const _ = require('yandex-cloud/lib/operation');
const {FunctionService} = require('yandex-cloud/api/serverless/functions/v1');
const {TriggerService, Trigger} = require('yandex-cloud/api/serverless/triggers/v1');
const {ServiceAccountService} = require('yandex-cloud/api/iam/v1');
const {FolderService} = require('yandex-cloud/api/resourcemanager/v1');
const {AccessBindingAction} = require('yandex-cloud/api/access');
const {InvokeService} = require('yandex-cloud/lib/serverless/functions/v1/invoke');

function readCliConfig() {
    const configFile = path.join(process.env.HOME, '.config/yandex-cloud/config.yaml');

    let config;
    try {
        config = yaml.parse(fs.readFileSync(configFile, 'utf8'));
    } catch (e) {
        throw new Error(`Failed to read config ${configFile}: ${e.toString()}`);
    }

    const current = config.current;
    if (!current) {
        throw new Error(`Invalid config in ${configFile}: no current profile selected`);
    }

    if (!config.profiles[current]) {
        throw new Error(`Invalid config in ${configFile}: no profile named ${current} exists`);
    }
    return config.profiles[current];
}

async function fileToBase64(filePath) {
    const data = await new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                return reject(err);
            }
            resolve(data);
        });
    });
    return data.toString('base64');
}

class YandexCloudProvider {
    static getProviderName() {
        return PROVIDER_NAME;
    }

    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.serverless.setProvider(PROVIDER_NAME, this);
    }

    async initConnectionsIfNeeded() {
        if (this.session) {
            return;
        }
        const config = readCliConfig();
        const session = new yc.Session({oauthToken: config.token});
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

    makeInvokeFunctionWithRetryParams(request) {
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
            deadLetterQueue: request.dlqId
                ? {
                      queueId: request.dlqId,
                      serviceAccountId: request.dlqAccountId,
                  }
                : undefined,
        };
    }

    async createCronTrigger(request) {
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

    convertS3EvenType(type) {
        return {
            'create.object': Trigger.ObjectStorageEventType.OBJECT_STORAGE_EVENT_TYPE_CREATE_OBJECT,
            'delete.object': Trigger.ObjectStorageEventType.OBJECT_STORAGE_EVENT_TYPE_DELETE_OBJECT,
            'update.object': Trigger.ObjectStorageEventType.OBJECT_STORAGE_EVENT_TYPE_UPDATE_OBJECT,
        }[type];
    }

    async createS3Trigger(request) {
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

    async createYMQTrigger(request) {
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
                        cutoff: {seconds: request.cutoff},
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

    async removeTrigger(id) {
        await this.initConnectionsIfNeeded();
        const operation = await this.triggers.delete({triggerId: id});
        return operation.completion(this.session);
    }

    async getTriggers() {
        await this.initConnectionsIfNeeded();
        const result = [];

        let nextPageToken = null;
        do {
            const responce = await this.triggers.list({
                folderId: this.folderId,
                pageToken: nextPageToken,
            });
            for (const trigger of responce.triggers) {
                result.push({
                    name: trigger.name,
                    id: trigger.id,
                });
            }
            nextPageToken = responce.nextPageToken;
        } while (nextPageToken);
        return result;
    }

    async getServiceAccounts() {
        await this.initConnectionsIfNeeded();
        const access = await this.getAccessBindings();

        const result = [];
        let nextPageToken = null;
        do {
            const responce = await this.serviceAccounts.list({
                folderId: this.folderId,
                pageToken: nextPageToken,
            });
            for (const account of responce.serviceAccounts) {
                result.push({
                    name: account.name,
                    id: account.id,
                    roles: access.filter((a) => a.subjectId === account.id).map((a) => a.role),
                });
            }
            nextPageToken = responce.nextPageToken;
        } while (nextPageToken);
        return result;
    }

    async getAccessBindings() {
        await this.initConnectionsIfNeeded();
        const result = [];

        let nextPageToken = null;
        do {
            const responce = await this.folders.listAccessBindings({
                resourceId: this.folderId,
                pageToken: nextPageToken,
            });
            for (const access of responce.accessBindings) {
                result.push({
                    role: access.roleId,
                    subjectId: access.subject.id,
                });
            }
            nextPageToken = responce.nextPageToken;
        } while (nextPageToken);
        return result;
    }

    async updateAccessBindings(saId, roles) {
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

    async createServiceAccount(request) {
        await this.initConnectionsIfNeeded();
        const operation = await this.serviceAccounts.create({
            folderId: this.folderId,
            name: request.name,
        });
        const response = await operation.completion(this.session);
        await this.updateAccessBindings(response.getResponse().id, request.roles);
        return response.getResponse();
    }

    async removeServiceAccount(id) {
        await this.initConnectionsIfNeeded();
        return this.serviceAccounts.delete({serviceAccountId: id});
    }

    async removeFunction(id) {
        await this.initConnectionsIfNeeded();
        const operation = await this.functions.delete({
            functionId: id,
        });
        return operation.completion(this.session);
    }

    async invokeFunction(id) {
        await this.initConnectionsIfNeeded();
        return this.invokeService.invoke(id);
    }

    async getFunctions() {
        await this.initConnectionsIfNeeded();
        const result = [];

        let nextPageToken = null;
        do {
            const response = await this.functions.list({
                folderId: this.folderId,
                pageToken: nextPageToken,
            });
            for (const func of response.functions) {
                result.push({
                    name: func.name,
                    id: func.id,
                });
            }
            nextPageToken = response.nextPageToken;
        } while (nextPageToken);
        return result;
    }

    async updateFunction(request) {
        await this.initConnectionsIfNeeded();
        const operation = await this.functions.createVersion({
            functionId: request.id,
            runtime: request.runtime,
            entrypoint: request.handler,
            resources: {memory: request.memory * 1024 * 1024},
            executionTimeout: {
                seconds: request.timeout,
            },
            serviceAccountId: request.serviceAccount,
            content: await fileToBase64(request.code),
            environment: request.environment,
        });
        return operation.completion(this.session);
    }

    async getFunctionLogs(id) {
        throw new Error('not implemented');
    }

    async createFunction(request) {
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

    async getMessageQueueId(url) {
        const response = await this.ymq
            .getQueueAttributes({
                QueueUrl: url,
                AttributeNames: ['QueueArn'],
            })
            .promise();

        return response.Attributes.QueueArn;
    }

    parseQueueName(url) {
        return url.slice(url.lastIndexOf('/') + 1);
    }

    async getMessageQueues() {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();
        const response = await this.ymq.listQueues().promise();
        const result = [];
        for (const url of response.QueueUrls) {
            result.push({
                id: await this.getMessageQueueId(url),
                name: this.parseQueueName(url),
                url,
            });
        }
        return result;
    }

    async createMessageQueue(request) {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();
        let response = await this.ymq.createQueue({QueueName: request.name}).promise();
        const url = response.QueueUrl;
        response = await this.ymq
            .getQueueAttributes({
                QueueUrl: url,
                AttributeNames: ['QueueArn'],
            })
            .promise();

        return {
            name: request.name,
            id: response.Attributes.QueueArn,
            url,
        };
    }

    async removeMessageQueue(url) {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();
        return this.ymq.deleteQueue({QueueUrl: url}).promise();
    }

    async getS3Buckets() {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();
        const response = await this.s3.listBuckets().promise();
        return response.Buckets.map((b) => {
            return {name: b.Name};
        });
    }

    async createS3Bucket(request) {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();
        return this.s3.createBucket({Bucket: request.name}).promise();
    }

    async removeS3Bucket(name) {
        await this.initConnectionsIfNeeded();
        await this.initAwsSdkIfNeeded();
        return this.s3.deleteBucket({Bucket: name}).promise();
    }
}

module.exports = YandexCloudProvider;
