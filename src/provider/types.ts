/* eslint-disable @typescript-eslint/indent */
import { PayloadFormatVersion } from '../types/common';

export interface InvokeFunctionRequest {
    functionId: string;
    serviceAccount?: string;
    retry?: {
        attempts: number;
        interval: number;
    };
    dlqId?: string;
    dlqAccountId?: string;
}

export type CodeOrPackage = { code: string } | { package: { bucketName: string, objectName: string } };

export interface UpdateFunctionRequest {
    id: string;
    runtime: string;
    handler: string;
    name?: string;
    memorySize?: number;
    timeout?: number;
    serviceAccount?: string;
    artifact: CodeOrPackage;
    environment?: Record<string, string>;
}

// TODO: get rid of 'any'
export type CreateFunctionRequest = any;
// TODO: get rid of 'any'
export type CreateCronTriggerRequest = any;

export interface CreateS3TriggerRequest extends InvokeFunctionRequest {
    name: string;
    events: string[];
    bucket?: string;
    prefix?: string;
    suffix?: string;
}

// TODO: get rid of 'any'
export type CreateYmqTriggerRequest = any;

export interface CreateCrTriggerRequest extends InvokeFunctionRequest {
    name: string;
    events: string[];
    registryId?: string;
    imageName?: string;
    tag?: string;
}

// TODO: get rid of 'any'
export type CreateServiceAccountRequest = any;
// TODO: get rid of 'any'
export type CreateMessageQueueRequest = {
    name: string;
    fifo?: boolean;
    fifoContentDeduplication?: boolean;
};
// TODO: get rid of 'any'
export type CreateS3BucketRequest = any;
// TODO: get rid of 'any'
export type CreateContainerRegistryRequest = any;

export type CreateApiGatewayRequest = {
    name: string;
    openapiSpec: string;
};

export type UpdateApiGatewayRequest = {
    id: string;
    name: string;
    openapiSpec: string;
};

export interface ProviderConfig {
    name: string;
    stage: string;
    versionFunctions: boolean;
    credentials: string;
    project: string;
    region: 'ru-central1',
    httpApi: {
        payload: PayloadFormatVersion.V0 | PayloadFormatVersion.V1
    },
    runtime: 'nodejs10' | 'nodejs12' | 'nodejs14' | 'nodejs16' | 'python27' | 'python37' | 'python38'
        | 'python39' | 'golang114' | 'golang116' | 'golang117' | 'java11' | 'dotnet31' | 'bash'
        | 'php74' | 'php8' | 'r4.0.2',
    memorySize: number, // Can be overridden by function configuration
    timeout: string, // Can be overridden by function configuration
    environment: { [key: string]: string }, // Can be overridden by function configuration
    vpc: string, // Can be overridden by function configuration
    labels: { [label: string]: string }, // Can be overridden by function configuration
    deploymentBucket: string | undefined;
    deploymentPrefix: string | undefined;
}
