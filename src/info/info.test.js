'use strict';

const YandexCloudInfo = require('./info');

let providerMock = null;
let serverlessMock = null;

beforeEach(() => {
    providerMock = {
        getFunctions: jest.fn(),
        getTriggers: jest.fn(),
        getServiceAccounts: jest.fn(),
        getS3Buckets: jest.fn(),
        getMessageQueues: jest.fn(),
    };

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

test('get functions info', async () => {
    serverlessMock.service = {
        functions: {
            func1: {name: 'yc-nodejs-dev-func1'},
            func2: {name: 'yc-nodejs-dev-func2'},
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
    };
    serverlessMock.cli = {
        log: jest.fn(),
    };

    providerMock.getFunctions.mockReturnValue([{name: 'yc-nodejs-dev-func1', id: 'id1'}]);
    const info = new YandexCloudInfo(serverlessMock, {});
    await info.info();
    expect(serverlessMock.cli.log).toBeCalledTimes(2);
    expect(serverlessMock.cli.log.mock.calls[0][0]).toBe('Function "func1" deployed with id "id1"');
    expect(serverlessMock.cli.log.mock.calls[1][0]).toBe('Function "func2" not deployed');
});
