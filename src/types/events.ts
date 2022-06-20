import {
    HttpMethodAlias,
    PayloadFormatVersion,
} from './common';

interface HttpAuthorizer {
    name?: string | undefined;
    resultTtlInSeconds?: number | string | undefined;
    identitySource?: string | undefined;
    identityValidationExpression?: string | undefined;
    type?: string | undefined;
}

interface HttpRequestParametersValidation {
    querystrings?: { [key: string]: boolean } | undefined;
    headers?: { [key: string]: boolean } | undefined;
    paths?: { [key: string]: boolean } | undefined;
}

interface HttpRequestValidation {
    parameters?: HttpRequestParametersValidation | undefined;
    schema?: { [key: string]: Record<string, unknown> } | undefined;
}

interface Http {
    path: string;
    method: HttpMethodAlias;
    eventFormat?: PayloadFormatVersion.V0 | PayloadFormatVersion.V1;
    authorizer?: HttpAuthorizer | string;
    request?: HttpRequestValidation;
    context?: Record<string, unknown>;
}

export enum S3Event {
    CREATE = 'create.object',
    DELETE = 'delete.object',
    UPDATE = 'update.object',
}

interface S3 {
    bucket: string;
    account: string;
    events: S3Event[];
    prefix: string | undefined;
    suffix: string | undefined;
    retry: EventRetryPolicy | undefined;
    dlq: string | undefined;
    dlqId: string | undefined;
    dlqAccountId: string | undefined;
    dlqAccount: string | undefined;
}

interface EventRetryPolicy {
    attempts: number;
    interval: number;
}

interface YMQ {
    queue: string;
    queueId: string | undefined;
    queueAccount: string;
    account: string;
    retry: EventRetryPolicy | undefined;
}

export interface Event {
    http?: Http | undefined | string;
    s3?: S3 | undefined;
    ymq?: YMQ | undefined;
}
