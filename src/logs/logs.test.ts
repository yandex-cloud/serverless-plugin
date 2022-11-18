import { YandexCloudLogs } from './logs';
import Serverless from '../types/serverless';

describe('Logs', () => {
    let providerMock: any;
    let serverlessMock: any;

    const mockOptions: Serverless.Options = {
        region: 'ru-central1',
        stage: 'prod',
    };

    beforeEach(() => {
        providerMock = {
            getFunctions: jest.fn(),
            getFunctionLogs: jest.fn(),
        };

        serverlessMock = {
            getProvider: () => providerMock,
        };
    });

    afterEach(() => {
        providerMock = null;
        serverlessMock = null;
    });

    test('function logs', async () => {
        serverlessMock.service = {
            functions: {
                func1: { name: 'yc-nodejs-dev-func1' },
                func2: { name: 'yc-nodejs-dev-func2' },
            },
            package: { artifact: 'codePath' },
            provider: { runtime: 'runtime' },
        };
        serverlessMock.cli = { log: jest.fn() };

        providerMock.getFunctions.mockReturnValue([{ name: 'yc-nodejs-dev-func1', id: 'id1' }]);
        const logs = new YandexCloudLogs(serverlessMock, { ...mockOptions, function: 'func1' });

        await logs.logs();
        expect(providerMock.getFunctionLogs).toBeCalledTimes(1);
        expect(providerMock.getFunctionLogs.mock.calls[0][0]).toBe('id1');
    });

    test('logs for unknown function', async () => {
        serverlessMock.service = {
            functions: {
                func2: { name: 'yc-nodejs-dev-func2' },
            },
            package: { artifact: 'codePath' },
            provider: { runtime: 'runtime' },
        };

        providerMock.getFunctions.mockReturnValue([{ name: 'yc-nodejs-dev-func1', id: 'id1' }]);
        const logs = new YandexCloudLogs(serverlessMock, { ...mockOptions, function: 'func1' });

        await logs.logs();
        expect(providerMock.getFunctionLogs).not.toBeCalled();
    });
});
