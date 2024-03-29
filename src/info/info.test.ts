import { YandexCloudInfo } from './info';
import { log } from '../utils/logging';
import Serverless from '../types/serverless';

jest.mock('../utils/logging', () => ({
    log: {
        warning: jest.fn(),
        notice: jest.fn(),
    },
}));

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
            getApiGateway: jest.fn(),
        };

        serverlessMock = {
            getProvider: () => providerMock,
        };
        jest.clearAllMocks();
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

        providerMock.getFunctions.mockReturnValue([{ name: 'yc-nodejs-dev-func1', id: 'id1' }]);
        providerMock.getApiGateway.mockReturnValue({ name: 'apigw' });
        const info = new YandexCloudInfo(serverlessMock, mockOptions);

        await info.info();
        expect(jest.mocked(log).notice.mock.calls[0][0]).toBe('Function "func1" deployed with id "id1"');
        expect(jest.mocked(log).warning.mock.calls[0][0]).toBe('Function "func2" not deployed');
    });
});
