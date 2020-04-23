'use strict';

const YandexCloudInvoke = require('./invoke');

let providerMock = null;
let serverlessMock = null;

beforeEach(() => {
    providerMock = {
        getFunctions: jest.fn(),
        invokeFunction: jest.fn(),
    };

    serverlessMock = {
        getProvider() {
            return providerMock;
        },
    };
    serverlessMock.cli = {log: jest.fn()};
});

afterEach(() => {
    providerMock = null;
    serverlessMock = null;
});

test('invoke function', async () => {
    serverlessMock.service = {
        functions: {
            func1: {name: 'yc-nodejs-dev-func1'},
            func2: {name: 'yc-nodejs-dev-func2'},
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
    };

    providerMock.getFunctions.mockReturnValue([{name: 'yc-nodejs-dev-func1', id: 'id1'}]);
    const invoke = new YandexCloudInvoke(serverlessMock, {function: 'func1'});
    await invoke.invoke();
    expect(providerMock.invokeFunction).toBeCalledTimes(1);
    expect(providerMock.invokeFunction.mock.calls[0][0]).toBe('id1');
});

test('invoke unknown function', async () => {
    serverlessMock.service = {
        functions: {
            func2: {name: 'yc-nodejs-dev-func2'},
        },
        package: {artifact: 'codePath'},
        provider: {runtime: 'runtime'},
    };

    providerMock.getFunctions.mockReturnValue([{name: 'yc-nodejs-dev-func1', id: 'id1'}]);
    const invoke = new YandexCloudInvoke(serverlessMock, {function: 'func1'});
    await invoke.invoke();
    expect(providerMock.invokeFunction).not.toBeCalled();
});
