'use strict';

const YandexCloudLogs = require('./logs');

let providerMock = null;
let serverlessMock = null;

beforeEach(() => {
    providerMock = {
        getFunctions: jest.fn(),
        getFunctionLogs: jest.fn(),
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

test('function logs', async () => {
    serverlessMock.service = {
        functions: {
            func1: {name: 'yc-nodejs-dev-func1'},
            func2: {name: 'yc-nodejs-dev-func2'},
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
    };
    serverlessMock.cli = {log: jest.fn()};

    providerMock.getFunctions.mockReturnValue([{name: 'yc-nodejs-dev-func1', id: 'id1'}]);
    const logs = new YandexCloudLogs(serverlessMock, {function: 'func1'});
    await logs.logs();
    expect(providerMock.getFunctionLogs).toBeCalledTimes(1);
    expect(providerMock.getFunctionLogs.mock.calls[0][0]).toBe('id1');
});

test('logs for unknown function', async () => {
    serverlessMock.service = {
        functions: {
            func2: {name: 'yc-nodejs-dev-func2'},
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
    };

    providerMock.getFunctions.mockReturnValue([{name: 'yc-nodejs-dev-func1', id: 'id1'}]);
    const logs = new YandexCloudLogs(serverlessMock, {function: 'func1'});
    await logs.logs();
    expect(providerMock.getFunctionLogs).not.toBeCalled();
});
