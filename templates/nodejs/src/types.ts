export interface FunctionContext {
    functionName: string;
    functionVersion: string;
    memoryLimitInMB: number;
    requestId: string;
    token?: {
        access_token: string;
        expires_in: number;
        token_type: string;
    };

    getRemainingTimeInMillis: () => number;
    getPayload: () => unknown;
}

export interface FunctionEvent {
    httpMethod: string;
    headers: Record<string, string>
    multiValueHeaders: Record<string, string[]>;
    queryStringParameters: Record<string, string>;
    multiValueQueryStringParameters: Record<string, string[]>;
    isBase64Encoded: boolean;
    body: unknown;
    requestContext: {
        httpMethod: string;
        requestId: string;
        requestTime: string;
        requestTimeEpoch: number;
        authorizer?: Record<string, string>;
        apiGateway?: Record<string, string>;
        identity: {
            sourceIp: string;
            userAgent: string;
        }
    }
}
