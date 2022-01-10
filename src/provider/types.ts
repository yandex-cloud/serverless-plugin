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

export interface UpdateFunctionRequest {
    id: string;
    runtime: string;
    handler: string;
    memory: number;
    timeout: number;
    serviceAccount?: string;
    code: string;
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
export type CreateMessageQueueRequest = any;
// TODO: get rid of 'any'
export type CreateS3BucketRequest = any;
// TODO: get rid of 'any'
export type CreateContainerRegistryRequest = any;
