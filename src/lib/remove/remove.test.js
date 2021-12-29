'use strict';

const YandexCloudRemove = require('./remove');

let providerMock = null;
let serverlessMock = null;

beforeEach(() => {
    providerMock = {
        getFunctions: jest.fn(),
        removeFunction: jest.fn(),
        getTriggers: jest.fn(),
        removeTrigger: jest.fn(),
        getServiceAccounts: jest.fn(),
        removeServiceAccount: jest.fn(),
        getS3Buckets: jest.fn(),
        getMessageQueues: jest.fn(),
    };

    providerMock.getS3Buckets.mockReturnValue([]);
    providerMock.getMessageQueues.mockReturnValue([]);

    serverlessMock = {
        getProvider() {
            return providerMock;
        },
    };
});

afterEach(() => {
    providerMock = null;
    serverlessMock = null;
});

test('remove service', async () => {
    serverlessMock.service = {
        functions: {
            func1: {name: 'yc-nodejs-dev-func1'},
            func2: {name: 'yc-nodejs-dev-func2'},
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
    serverlessMock.cli = {log: jest.fn()};

    providerMock.getFunctions.mockReturnValue([{name: 'yc-nodejs-dev-func1', id: 'id1'}]);
    providerMock.getTriggers.mockReturnValue([{name: 'yc-nodejs-dev-func1-cron', id: 'id2'}]);
    providerMock.getServiceAccounts.mockReturnValue([{name: 'triggerSA', id: 'id3'}]);
    const remove = new YandexCloudRemove(serverlessMock, {});
    await remove.remove();
    expect(providerMock.removeFunction).toBeCalledTimes(1);
    expect(providerMock.removeFunction.mock.calls[0][0]).toBe('id1');
    expect(providerMock.removeTrigger).toBeCalledTimes(1);
    expect(providerMock.removeTrigger.mock.calls[0][0]).toBe('id2');
    expect(providerMock.removeServiceAccount).toBeCalledTimes(1);
    expect(providerMock.removeServiceAccount.mock.calls[0][0]).toBe('id3');
});
