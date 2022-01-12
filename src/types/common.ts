import Serverless from 'serverless';

export interface MessageQueueInfo {
    id: string;
    name: string;
    url: string;
}

export interface FunctionInfo {
    id: string;
    name: string;
}

export interface TriggerInfo {
    id: string;
    name: string;
}

export interface ServiceAccountInfo {
    id: string;
    name: string;
    roles: string[];
}

export interface S3BucketInfo {
    name: string;
}

export interface ServerlessFunc extends Serverless.FunctionDefinition {
    account: string;
    handler: string;
}
