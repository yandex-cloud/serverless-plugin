import { OpenApiSpec } from './openapi-spec';
import { YCFunction } from './function';

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
    progress: {
        create: jest.fn(() => ({
            update: jest.fn(),
            remove: jest.fn(),
        })),
    },
}));

describe('OpenAPI Spec', () => {
    let providerMock: any;
    let serverlessMock: any;
    let deployMock: any;

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
            createCRTrigger: jest.fn(),
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
            createContainerRegistry: jest.fn(),
            removeContainerRegistry: jest.fn(),
            getContainerRegistries: jest.fn(),
        };

        providerMock.getFunctions.mockReturnValue([]);
        providerMock.getTriggers.mockReturnValue([]);
        providerMock.getMessageQueues.mockReturnValue([]);
        providerMock.getS3Buckets.mockReturnValue([]);
        providerMock.getContainerRegistries.mockReturnValue([]);
        providerMock.getServiceAccounts.mockReturnValue([{ name: 'acc', id: 'acc_id' }]);

        serverlessMock = {
            getProvider: () => providerMock,
            cli: {
                log: console.log,
            },
            resources: {
                acc: {
                    type: 'yc::ServiceAccount',
                    roles: ['editor'],
                },
            },
            service: {
                provider: {
                    httpApi: {
                        payload: '1.0',
                    },
                },
            },
        };

        deployMock = {
            serverless: serverlessMock,
            options: {},
            provider: providerMock,
            apiGatewayRegistry: {},
            functionRegistry: {},
            triggerRegistry: {},
            serviceAccountRegistry: {},
            messageQueueRegistry: {},
            objectStorageRegistry: {},
            containerRegistryRegistry: {},
            getServiceAccountId: jest.fn(),
            getApiGateway: jest.fn(),
        };
        deployMock.getServiceAccountId.mockReturnValue('acc_id');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return of JSON', () => {
        const spec = new OpenApiSpec('serverless', []);
        const expected = {
            openapi: '3.0.0',
            paths: {},
            info: { title: 'serverless', version: '1.0.0' },
        };

        expect(spec.toJson()).toEqual(expected);
    });

    it('should add pathes for functions with `http` event', () => {
        const func = new YCFunction(serverlessMock, deployMock, { id: 'func_id', name: 'func_name' });

        func.setNewState({
            name: 'func_name',
            params: {
                account: 'acc',
                handler: 'index.handler',
                runtime: '',
                timeout: 3,
                memorySize: 128,
                environment: {},
                events: [
                    {
                        http: {
                            path: '/any',
                            method: 'any' as any,
                        },
                    },
                    {
                        http: {
                            path: '/post',
                            method: 'post',
                        },
                    },
                ],
                tags: {},
            },
        });
        const spec = new OpenApiSpec('serverless', [func]);
        const expected = {
            openapi: '3.0.0',
            paths: {
                '/any': {
                    'x-yc-apigateway-any-method': {
                        'x-yc-apigateway-integration': {
                            context: undefined,
                            function_id: 'func_id',
                            payload_format_version: '1.0',
                            service_account_id: 'acc_id',
                            tag: '$latest',
                            type: 'cloud_functions',
                        },
                        responses: {
                            200: {
                                description: 'ok',
                            },
                        },
                    },
                },
                '/post': {
                    post: {
                        'x-yc-apigateway-integration': {
                            context: undefined,
                            function_id: 'func_id',
                            payload_format_version: '1.0',
                            service_account_id: 'acc_id',
                            tag: '$latest',
                            type: 'cloud_functions',
                        },
                        responses: {
                            200: {
                                description: 'ok',
                            },
                        },
                    },
                },
            },
            info: { title: 'serverless', version: '1.0.0' },
        };

        expect(spec.toJson()).toEqual(expected);
    });
    it('should merge when declared multiple methods for same path', () => {
        const func = new YCFunction(serverlessMock, deployMock, { id: 'func_id', name: 'func_name' });

        func.setNewState({
            name: 'func_name',
            params: {
                account: 'acc',
                handler: 'index.handler',
                runtime: '',
                timeout: 3,
                memorySize: 128,
                environment: {},
                events: [
                    {
                        http: {
                            path: '/foo',
                            method: 'get' as any,
                        },
                    },
                    {
                        http: {
                            path: '/foo',
                            method: 'post',
                        },
                    },
                ],
                tags: {},
            },
        });
        const spec = new OpenApiSpec('serverless', [func]);
        const expected = {
            openapi: '3.0.0',
            paths: {
                '/foo': {
                    get: {
                        'x-yc-apigateway-integration': {
                            context: undefined,
                            function_id: 'func_id',
                            payload_format_version: '1.0',
                            service_account_id: 'acc_id',
                            tag: '$latest',
                            type: 'cloud_functions',
                        },
                        responses: {
                            200: {
                                description: 'ok',
                            },
                        },
                    },
                    post: {
                        'x-yc-apigateway-integration': {
                            context: undefined,
                            function_id: 'func_id',
                            payload_format_version: '1.0',
                            service_account_id: 'acc_id',
                            tag: '$latest',
                            type: 'cloud_functions',
                        },
                        responses: {
                            200: {
                                description: 'ok',
                            },
                        },
                    },
                },
            },
            info: { title: 'serverless', version: '1.0.0' },
        };

        expect(spec.toJson()).toEqual(expected);
    });

    it('should merge when same path declared in different functions', () => {
        const func1 = new YCFunction(serverlessMock, deployMock, { id: 'func_id1', name: 'func_name' });
        const func2 = new YCFunction(serverlessMock, deployMock, { id: 'func_id2', name: 'func_name' });

        func1.setNewState({
            name: 'func_name',
            params: {
                account: 'acc',
                handler: 'index.handler',
                runtime: '',
                timeout: 3,
                memorySize: 128,
                environment: {},
                events: [
                    {
                        http: {
                            path: '/foo',
                            method: 'get' as any,
                        },
                    },
                ],
                tags: {},
            },
        });

        func2.setNewState({
            name: 'func_name',
            params: {
                account: 'acc',
                handler: 'index.handler',
                runtime: '',
                timeout: 3,
                memorySize: 128,
                environment: {},
                events: [
                    {
                        http: {
                            path: '/foo',
                            method: 'post' as any,
                        },
                    },
                ],
                tags: {},
            },
        });
        const spec = new OpenApiSpec('serverless', [func2, func1]);
        const expected = {
            openapi: '3.0.0',
            paths: {
                '/foo': {
                    get: {
                        'x-yc-apigateway-integration': {
                            context: undefined,
                            function_id: 'func_id1',
                            payload_format_version: '1.0',
                            service_account_id: 'acc_id',
                            tag: '$latest',
                            type: 'cloud_functions',
                        },
                        responses: {
                            200: {
                                description: 'ok',
                            },
                        },
                    },
                    post: {
                        'x-yc-apigateway-integration': {
                            context: undefined,
                            function_id: 'func_id2',
                            payload_format_version: '1.0',
                            service_account_id: 'acc_id',
                            tag: '$latest',
                            type: 'cloud_functions',
                        },
                        responses: {
                            200: {
                                description: 'ok',
                            },
                        },
                    },
                },
            },
            info: { title: 'serverless', version: '1.0.0' },
        };

        expect(spec.toJson()).toEqual(expected);
    });

    it('should throw an error if genric method collide with specific', () => {
        const func1 = new YCFunction(serverlessMock, deployMock, { id: 'func_id1', name: 'func_name' });
        const func2 = new YCFunction(serverlessMock, deployMock, { id: 'func_id2', name: 'func_name' });

        func1.setNewState({
            name: 'func_name',
            params: {
                account: 'acc',
                handler: 'index.handler',
                runtime: '',
                timeout: 3,
                memorySize: 128,
                environment: {},
                events: [
                    {
                        http: {
                            path: '/foo',
                            method: 'get' as any,
                        },
                    },
                ],
                tags: {},
            },
        });

        func2.setNewState({
            name: 'func_name',
            params: {
                account: 'acc',
                handler: 'index.handler',
                runtime: '',
                timeout: 3,
                memorySize: 128,
                environment: {},
                events: [
                    {
                        http: {
                            path: '/foo',
                            method: 'any' as any,
                        },
                    },
                ],
                tags: {},
            },
        });

        expect(() => new OpenApiSpec('serverless', [func2, func1])).toThrow();
    });
});
