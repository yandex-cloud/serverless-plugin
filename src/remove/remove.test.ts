import { YandexCloudRemove } from './remove';
import Serverless from '../types/serverless';

describe('Remove', () => {
    let providerMock: any;
    let serverlessMock: any;

    const mockOptions: Serverless.Options = {
        region: 'ru-central1',
        stage: 'prod',
    };

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
            getApiGateway: jest.fn(),
            removeApiGateway: jest.fn(),
        };

        providerMock.getS3Buckets.mockReturnValue([]);
        providerMock.getMessageQueues.mockReturnValue([]);

        serverlessMock = {
            getProvider: () => providerMock,
        };
    });

    afterEach(() => {
        providerMock = null;
        serverlessMock = null;
    });

    test('remove service', async () => {
        serverlessMock.service = {
            functions: {
                func1: {
                    name: 'yc-nodejs-dev-func1',
                    events: [
                        {
                            cron: {
                                name: 'yc-nodejs-dev-func1-cron',
                                id: 'id2',
                            },
                        },
                    ],
                },
                func2: {
                    name: 'yc-nodejs-dev-func2',
                    events: [],
                },
            },
            package: { artifact: 'codePath' },
            provider: { runtime: 'runtime' },
            resources: {
                triggerSA: {
                    type: 'yc::ServiceAccount',
                    roles: ['serverless.functions.invoker'],
                },
            },
        };
        serverlessMock.cli = { log: jest.fn() };

        providerMock.getFunctions.mockReturnValue([{
            name: 'yc-nodejs-dev-func1',
            id: 'id1',
        }]);
        providerMock.getTriggers.mockReturnValue([{
            name: 'yc-nodejs-dev-func1-cron',
            id: 'id2',
        }]);
        providerMock.getServiceAccounts.mockReturnValue([{
            name: 'triggerSA',
            id: 'id3',
        }]);
        providerMock.getApiGateway.mockReturnValue({
            name: 'apiGw',
            id: 'id4',
        });
        const remove = new YandexCloudRemove(serverlessMock, mockOptions);

        await remove.remove();
        expect(providerMock.removeFunction).toBeCalledTimes(1);
        expect(providerMock.removeFunction.mock.calls[0][0]).toBe('id1');
        expect(providerMock.removeTrigger).toBeCalledTimes(1);
        expect(providerMock.removeTrigger.mock.calls[0][0]).toBe('id2');
        expect(providerMock.removeServiceAccount).toBeCalledTimes(1);
        expect(providerMock.removeServiceAccount.mock.calls[0][0]).toBe('id3');
        expect(providerMock.removeApiGateway).toBeCalledTimes(1);
        expect(providerMock.removeApiGateway.mock.calls[0][0]).toBe('id4');
    });
});
