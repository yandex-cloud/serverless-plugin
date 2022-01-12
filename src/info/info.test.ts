import Serverless from 'serverless';
import { YandexCloudInfo } from './info';

describe('Info', () => {
    let providerMock: any;
    let serverlessMock: any;

    const mockOptions: Serverless.Options = {
        region: 'ru-central1',
        stage: 'prod',
    };

    beforeEach(() => {
        providerMock = {
            getFunctions: jest.fn(),
            getTriggers: jest.fn(),
            getServiceAccounts: jest.fn(),
            getS3Buckets: jest.fn(),
            getMessageQueues: jest.fn(),
        };

        serverlessMock = {
            getProvider: () => providerMock,
        };
    });

    afterEach(() => {
        providerMock = null;
        serverlessMock = null;
    });

    test('get functions info', async () => {
        serverlessMock.service = {
            functions: {
                func1: { name: 'yc-nodejs-dev-func1' },
                func2: { name: 'yc-nodejs-dev-func2' },
            },
            package: { artifact: 'codePath' },
            provider: { runtime: 'runtime' },
        };
        serverlessMock.cli = {
            log: jest.fn(),
        };

        providerMock.getFunctions.mockReturnValue([{ name: 'yc-nodejs-dev-func1', id: 'id1' }]);
        const info = new YandexCloudInfo(serverlessMock, mockOptions);

        await info.info();
        expect(serverlessMock.cli.log).toBeCalledTimes(2);
        expect(serverlessMock.cli.log.mock.calls[0][0]).toBe('Function "func1" deployed with id "id1"');
        expect(serverlessMock.cli.log.mock.calls[1][0]).toBe('Function "func2" not deployed');
    });
});
