/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-misused-new */
import Serverless from './serverless';
import { Event } from './events';
import { ProviderConfig } from '../provider/types';

declare namespace Service {
    interface Custom {
        [key: string]: any;
    }
}

export default interface Service {
    custom: Service.Custom;

    provider: ProviderConfig;
    serverless: Serverless;
    service: string | null;
    plugins: string[];
    pluginsData: { [key: string]: any };
    functions: { [key: string]: Serverless.FunctionDefinitionHandler | Serverless.FunctionDefinitionImage };
    resources: | {
        Resources: {
            [key: string]: any;
        };
    }
    | { [key: string]: any };
    package: { [key: string]: any };
    configValidationMode: string;
    disabledDeprecations?: any[] | undefined;
    serviceFilename?: string | undefined;
    app?: any;
    tenant?: any;
    org?: any;
    layers: { [key: string]: any };
    outputs?: any;
    initialServerlessConfig: any;

    new(serverless: Serverless, data: Record<string, unknown>): Service;

    load(rawOptions: Record<string, unknown>): Promise<any>;

    setFunctionNames(rawOptions: Record<string, unknown>): void;

    getServiceName(): string;

    getAllFunctions(): string[];

    getAllFunctionsNames(): string[];

    getFunction(functionName: string): Serverless.FunctionDefinitionHandler | Serverless.FunctionDefinitionImage;

    getEventInFunction(eventName: string, functionName: string): Event;

    getAllEventsInFunction(functionName: string): Event[];

    mergeResourceArrays(): void;

    validate(): Service;

    update(data: Record<string, unknown>): Record<string, unknown>;

}
