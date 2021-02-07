'use strict';

const YandexCloudDeploy = require('./deploy');

let providerMock = null;
let serverlessMock = null;

beforeEach(() => {
    providerMock = {
        createFunction: jest.fn(),
        getFunctions: jest.fn(),
        updateFunction: jest.fn(),
        removeFunction: jest.fn(),
        getTriggers: jest.fn(),
        createCronTrigger: jest.fn(),
        createS3Trigger: jest.fn(),
        createYMQTrigger: jest.fn(),
        removeTrigger: jest.fn(),
        getServiceAccounts: jest.fn(),
        createServiceAccount: jest.fn(),
        removeServiceAccount: jest.fn(),
        getMessageQueues: jest.fn(),
        createMessageQueue: jest.fn(),
        removeMessageQueue: jest.fn(),
        getS3Buckets: jest.fn(),
        createS3Bucket: jest.fn(),
        removeS3Bucket: jest.fn(),
    };

    providerMock.getFunctions.mockReturnValue([]);
    providerMock.getTriggers.mockReturnValue([]);
    providerMock.getServiceAccounts.mockReturnValue([]);
    providerMock.getMessageQueues.mockReturnValue([]);
    providerMock.getS3Buckets.mockReturnValue([]);

    serverlessMock = {
        getProvider() {
            return providerMock;
        },
    };
    serverlessMock.cli = {
        log: jest.fn(),
    };
});

afterEach(() => {
    providerMock = null;
    serverlessMock = null;
});

test('Create new functions', async () => {
    serverlessMock.service = {
        functions: {
            func1: {name: 'yc-nodejs-dev-func1', account: 'acc'},
            func2: {name: 'yc-nodejs-dev-func2'},
            func3: {name: 'yc-nodejs-dev-func3', environment: {foo: 'bar'}},
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
        resources: {
            acc: {
                type: 'yc::ServiceAccount',
                roles: ['editor'],
            },
        },
    };
    providerMock.createFunction.mockReturnValue({id: 'id'});
    providerMock.createServiceAccount.mockReturnValue({id: 'SA_ID'});
    const deploy = new YandexCloudDeploy(serverlessMock, {});
    await deploy.deploy();
    expect(providerMock.createFunction).toBeCalledTimes(3);
    expect(providerMock.createFunction.mock.calls[0][0].serviceAccount).toBe('SA_ID');
    expect(providerMock.createFunction.mock.calls[2][0].environment).toEqual({foo: 'bar'});
});

test('Update function', async () => {
    serverlessMock.service = {
        functions: {
            func1: {name: 'yc-nodejs-dev-func1'},
            func2: {name: 'yc-nodejs-dev-func2'},
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
    };

    providerMock.getFunctions.mockReturnValue([{name: 'yc-nodejs-dev-func1', id: 'id1'}]);
    providerMock.createFunction.mockReturnValue({id: 'id2'});
    const deploy = new YandexCloudDeploy(serverlessMock, {});
    await deploy.deploy();
    expect(providerMock.createFunction).toBeCalledTimes(1);
    expect(providerMock.updateFunction).toBeCalledTimes(1);
    expect(providerMock.updateFunction.mock.calls[0][0].id).toBe('id1');
    expect(providerMock.removeFunction).not.toBeCalled();
});

test('Do not remove unnecessary', async () => {
    serverlessMock.service = {
        functions: {
            func1: {name: 'yc-nodejs-dev-func1'},
            func2: {name: 'yc-nodejs-dev-func2'},
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
    };

    providerMock.getFunctions.mockReturnValue([
        {name: 'yc-nodejs-dev-func1', id: 'id1'},
        {name: 'yc-nodejs-dev-func2', id: 'id2'},
        {name: 'yc-nodejs-dev-func3', id: 'id3'},
    ]);
    providerMock.getS3Buckets.mockReturnValue([{name: 'bucket', id: 'id'}]);
    providerMock.getMessageQueues.mockReturnValue([{name: 'queue', id: 'id', url: 'url'}]);
    providerMock.getServiceAccounts.mockReturnValue([{name: 'acc', id: 'id'}]);
    providerMock.getTriggers.mockReturnValue([{name: 'trigger', id: 'id'}]);
    const deploy = new YandexCloudDeploy(serverlessMock, {});
    await deploy.deploy();
    expect(providerMock.createFunction).not.toBeCalled();
    expect(providerMock.removeFunction).not.toBeCalled();
    expect(providerMock.removeS3Bucket).not.toBeCalled();
    expect(providerMock.removeTrigger).not.toBeCalled();
    expect(providerMock.removeServiceAccount).not.toBeCalled();
    expect(providerMock.removeMessageQueue).not.toBeCalled();
    expect(providerMock.updateFunction).toBeCalledTimes(2);
});

test('deploy single function', async () => {
    serverlessMock.service = {
        functions: {
            func1: {name: 'yc-nodejs-dev-func1'},
            func2: {name: 'yc-nodejs-dev-func2'},
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
    };

    providerMock.createFunction.mockReturnValue({id: 'id1'});
    const deploy = new YandexCloudDeploy(serverlessMock, {function: 'func1'});
    await deploy.deploy();
    expect(providerMock.createFunction).toBeCalledTimes(1);
});

test('deploy function with timer', async () => {
    serverlessMock.service = {
        functions: {
            func1: {
                name: 'yc-nodejs-dev-func1',
                events: [
                    {
                        cron: {
                            expression: '* * * * ? *',
                            account: 'triggerSA',
                        },
                    },
                ],
            },
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
        resources: {
            triggerSA: {
                type: 'yc::ServiceAccount',
                roles: ['serverless.functions.invoker'],
            },
        },
    };

    providerMock.createFunction.mockReturnValue({id: 'id1'});
    providerMock.createServiceAccount.mockReturnValue({id: 'SA_ID'});
    const deploy = new YandexCloudDeploy(serverlessMock, {});
    await deploy.deploy();
    expect(providerMock.createServiceAccount).toBeCalledTimes(1);
    expect(providerMock.createServiceAccount.mock.calls[0][0].name).toBe('triggerSA');
    expect(providerMock.createFunction).toBeCalledTimes(1);
    expect(providerMock.createCronTrigger).toBeCalledTimes(1);
    expect(providerMock.createCronTrigger.mock.calls[0][0].functionId).toBe('id1');
    expect(providerMock.createCronTrigger.mock.calls[0][0].serviceAccount).toBe('SA_ID');
});

test('deploy existing function with timer', async () => {
    serverlessMock.service = {
        functions: {
            func1: {
                name: 'yc-nodejs-dev-func1',
                events: [
                    {
                        cron: {
                            expression: '* * * * ? *',
                            account: 'triggerSA',
                        },
                    },
                ],
            },
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
        resources: {
            triggerSA: {
                type: 'yc::ServiceAccount',
                roles: ['serverless.functions.invoker'],
            },
        },
    };

    providerMock.getFunctions.mockReturnValue([{name: 'yc-nodejs-dev-func1', id: 'id1'}]);
    providerMock.getTriggers.mockReturnValue([{name: 'yc-nodejs-dev-func1-cron', id: 'id2'}]);
    providerMock.getServiceAccounts.mockReturnValue([
        {
            name: 'triggerSA',
            id: 'SA_ID',
            roles: ['serverless.functions.invoker'],
        },
    ]);
    const deploy = new YandexCloudDeploy(serverlessMock, {});
    await deploy.deploy();
    expect(providerMock.updateFunction).toBeCalledTimes(1);
    expect(providerMock.removeTrigger).toBeCalledTimes(1);
    expect(providerMock.removeTrigger.mock.calls[0][0]).toBe('id2');
    expect(providerMock.removeServiceAccount).not.toBeCalled();
    expect(providerMock.createCronTrigger).toBeCalledTimes(1);
    expect(providerMock.createCronTrigger.mock.calls[0][0].functionId).toBe('id1');
    expect(providerMock.createServiceAccount).not.toBeCalled();
});

test('remove cron from function', async () => {
    serverlessMock.service = {
        functions: {
            func1: {
                name: 'yc-nodejs-dev-func1',
            },
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
    };

    providerMock.getFunctions.mockReturnValue([{name: 'yc-nodejs-dev-func1', id: 'id1'}]);
    providerMock.getTriggers.mockReturnValue([{name: 'yc-nodejs-dev-func1-cron', id: 'id2'}]);
    providerMock.createFunction.mockReturnValue({id: 'id3'});
    const deploy = new YandexCloudDeploy(serverlessMock, {});
    await deploy.deploy();
    expect(providerMock.updateFunction).toBeCalledTimes(1);
    expect(providerMock.removeTrigger).toBeCalledTimes(1);
    expect(providerMock.removeTrigger.mock.calls[0][0]).toBe('id2');
    expect(providerMock.createCronTrigger).not.toBeCalled();
});

test('deploy function with s3 event', async () => {
    serverlessMock.service = {
        functions: {
            func1: {
                name: 'yc-nodejs-dev-func1',
                events: [
                    {
                        s3: {
                            events: ['create.object'],
                            bucket: 'bucket',
                            prefix: 'prefix',
                            suffix: 'suffix',
                            account: 'triggerSA',
                            dlq: 'triggerDlq',
                            retry: {
                                attempts: 1,
                                interval: 10,
                            },
                        },
                    },
                ],
            },
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
        resources: {
            triggerSA: {
                type: 'yc::ServiceAccount',
                roles: ['serverless.functions.invoker'],
            },
            bucket: {
                type: 'yc::ObjectStorageBucket',
            },
            triggerDlq: {
                type: 'yc::MessageQueue',
            },
        },
    };

    providerMock.createFunction.mockReturnValue({id: 'id1'});
    providerMock.createServiceAccount.mockReturnValue({id: 'SA_ID'});
    providerMock.createMessageQueue.mockReturnValue({id: 'dlq-id'});
    const deploy = new YandexCloudDeploy(serverlessMock, {});
    await deploy.deploy();
    expect(providerMock.createServiceAccount).toBeCalledTimes(1);
    expect(providerMock.createServiceAccount.mock.calls[0][0].name).toBe('triggerSA');
    expect(providerMock.createFunction).toBeCalledTimes(1);
    expect(providerMock.createS3Trigger).toBeCalledTimes(1);
    expect(providerMock.createS3Trigger.mock.calls[0][0]).toEqual({
        account: 'triggerSA',
        bucket: 'bucket',
        dlq: 'triggerDlq',
        dlqId: 'dlq-id',
        events: ['create.object'],
        functionId: 'id1',
        name: 'yc-nodejs-dev-func1-s3',
        prefix: 'prefix',
        retry: {
            attempts: 1,
            interval: 10,
        },
        serviceAccount: 'SA_ID',
        suffix: 'suffix',
    });
    expect(providerMock.createS3Bucket).toBeCalledTimes(1);
    expect(providerMock.createS3Bucket.mock.calls[0][0].name).toBe('bucket');
});

test('deploy function with YMQ event', async () => {
    serverlessMock.service = {
        functions: {
            func1: {
                name: 'yc-nodejs-dev-func1',
                events: [
                    {
                        ymq: {
                            queue: 'testQueue',
                            queueAccount: 'triggerSA',
                            account: 'queueSA',
                        },
                    },
                ],
            },
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
        resources: {
            triggerSA: {
                type: 'yc::ServiceAccount',
                roles: ['serverless.functions.invoker'],
            },
            queueSA: {
                type: 'yc::ServiceAccount',
                roles: ['editor'],
            },
            testQueue: {
                type: 'yc::MessageQueue',
            },
        },
    };

    providerMock.createFunction.mockReturnValue({id: 'id1'});
    providerMock.createServiceAccount.mockReturnValue({id: 'SA_ID'});
    providerMock.createMessageQueue.mockReturnValue({id: 'queue-id'});
    const deploy = new YandexCloudDeploy(serverlessMock, {});
    await deploy.deploy();
    expect(providerMock.createServiceAccount).toBeCalledTimes(2);
    expect(providerMock.createServiceAccount.mock.calls[0][0].name).toBe('triggerSA');
    expect(providerMock.createServiceAccount.mock.calls[1][0].name).toBe('queueSA');
    expect(providerMock.createFunction).toBeCalledTimes(1);
    expect(providerMock.createMessageQueue).toBeCalledTimes(1);
    expect(providerMock.createMessageQueue.mock.calls[0][0].name).toBe('testQueue');
    expect(providerMock.createYMQTrigger).toBeCalledTimes(1);
    expect(providerMock.createYMQTrigger.mock.calls[0][0].functionId).toBe('id1');
    expect(providerMock.createYMQTrigger.mock.calls[0][0].name).toBe('yc-nodejs-dev-func1-ymq');
    expect(providerMock.createYMQTrigger.mock.calls[0][0].queueId).toBe('queue-id');
    expect(providerMock.createYMQTrigger.mock.calls[0][0].serviceAccount).toBe('SA_ID');
    expect(providerMock.createYMQTrigger.mock.calls[0][0].queueServiceAccount).toBe('SA_ID');
});

test('deploy function with YMQ event and existing queue', async () => {
    serverlessMock.service = {
        functions: {
            func1: {
                name: 'yc-nodejs-dev-func1',
                events: [
                    {
                        ymq: {
                            queue: 'testQueue',
                            queueAccount: 'triggerSA',
                            account: 'queueSA',
                        },
                    },
                ],
            },
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
        resources: {
            triggerSA: {
                type: 'yc::ServiceAccount',
                roles: ['serverless.functions.invoker'],
            },
            queueSA: {
                type: 'yc::ServiceAccount',
                roles: ['editor'],
            },
            testQueue: {
                type: 'yc::MessageQueue',
            },
        },
    };

    providerMock.createFunction.mockReturnValue({id: 'id1'});
    providerMock.createServiceAccount.mockReturnValue({id: 'SA_ID'});
    providerMock.getMessageQueues.mockReturnValue([
        {
            id: 'queue-id',
            name: 'testQueue',
            url: 'queue-url',
        },
    ]);
    providerMock.createMessageQueue.mockReturnValue({id: 'queue-id'});
    const deploy = new YandexCloudDeploy(serverlessMock, {});
    await deploy.deploy();
    expect(providerMock.createServiceAccount).toBeCalledTimes(2);
    expect(providerMock.createServiceAccount.mock.calls[0][0].name).toBe('triggerSA');
    expect(providerMock.createServiceAccount.mock.calls[1][0].name).toBe('queueSA');
    expect(providerMock.createFunction).toBeCalledTimes(1);
    expect(providerMock.createMessageQueue).not.toBeCalled();
    expect(providerMock.removeMessageQueue).not.toBeCalled();
    expect(providerMock.createYMQTrigger).toBeCalledTimes(1);
    expect(providerMock.createYMQTrigger.mock.calls[0][0].functionId).toBe('id1');
    expect(providerMock.createYMQTrigger.mock.calls[0][0].name).toBe('yc-nodejs-dev-func1-ymq');
    expect(providerMock.createYMQTrigger.mock.calls[0][0].queueId).toBe('queue-id');
    expect(providerMock.createYMQTrigger.mock.calls[0][0].serviceAccount).toBe('SA_ID');
    expect(providerMock.createYMQTrigger.mock.calls[0][0].queueServiceAccount).toBe('SA_ID');
});
