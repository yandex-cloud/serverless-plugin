import Serverless from 'serverless';
import { YandexCloudInvoke } from './invoke';

jest.mock('../utils/logging', () => ({
    log: {
        error: jest.fn(),
        warning: jest.fn(),
        notice: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
        success: jest.fn(),
    },
    writeText: jest.fn(),
    progress: jest.fn(() => ({
        update: jest.fn(),
        remove: jest.fn(),
    })),
}));

describe('Invoke', () => {
    let providerMock: any;
    let serverlessMock: any;

    const mockOptions: Serverless.Options = {
        region: 'ru-central1',
        stage: 'prod',
    };

    beforeEach(() => {
        providerMock = {
            getFunctions: jest.fn(),
            invokeFunction: jest.fn(),
        };

        serverlessMock = {
            getProvider: () => providerMock,
        };
        serverlessMock.cli = { log: jest.fn() };
    });

    afterEach(() => {
        providerMock = null;
        serverlessMock = null;
    });

    test('invoke function', async () => {
        serverlessMock.service = {
            functions: {
                func1: { name: 'yc-nodejs-dev-func1' },
                func2: { name: 'yc-nodejs-dev-func2' },
            },
            package: { artifact: 'codePath' },
            provider: { runtime: 'runtime' },
        };

        providerMock.getFunctions.mockReturnValue([{ name: 'yc-nodejs-dev-func1', id: 'id1' }]);
        const invoke = new YandexCloudInvoke(serverlessMock, { ...mockOptions, function: 'func1' });

        await invoke.invoke();
        expect(providerMock.invokeFunction).toBeCalledTimes(1);
        expect(providerMock.invokeFunction.mock.calls[0][0]).toBe('id1');
    });

    test('invoke unknown function', async () => {
        serverlessMock.service = {
            functions: {
                func2: { name: 'yc-nodejs-dev-func2' },
            },
            package: { artifact: 'codePath' },
            provider: { runtime: 'runtime' },
        };

        providerMock.getFunctions.mockReturnValue([{ name: 'yc-nodejs-dev-func1', id: 'id1' }]);
        const invoke = new YandexCloudInvoke(serverlessMock, { ...mockOptions, function: 'func1' });

        await invoke.invoke();
        expect(providerMock.invokeFunction).not.toBeCalled();
    });
});
