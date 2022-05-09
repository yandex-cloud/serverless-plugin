import { Package } from 'serverless';
import { OpenAPIV3 } from 'openapi-types';


export const X_YC_API_GATEWAY_AUTHORIZER = 'x-yc-apigateway-authorizer';
export const X_YC_API_GATEWAY_INTEGRATION = 'x-yc-apigateway-integration';
export const X_YC_API_GATEWAY_ANY_METHOD = 'x-yc-apigateway-any-method';
export const X_YC_API_GATEWAY = 'x-yc-apigateway';

export enum HttpMethods {
    GET = 'get',
    PUT = 'put',
    POST = 'post',
    DELETE = 'delete',
    OPTIONS = 'options',
    HEAD = 'head',
    PATCH = 'patch',
    TRACE = 'trace',
    X_YC_API_GATEWAY_ANY_METHOD = 'x-yc-apigateway-any-method'
}

export type HttpMethod = HttpMethods.GET |
    HttpMethods.PUT |
    HttpMethods.POST |
    HttpMethods.DELETE |
    HttpMethods.OPTIONS |
    HttpMethods.HEAD |
    HttpMethods.PATCH |
    HttpMethods.TRACE |
    HttpMethods.X_YC_API_GATEWAY_ANY_METHOD;

export enum PayloadFormatVersion {
    V0 = '0.1', V1 = '1.0',
}

// export type ExtendedSecuritySchemeObject = OpenAPIV3.SecuritySchemeObject & {[prop: string]: unknown};
// export type ExtendedDocument = OpenAPIV3.Document & {[prop: string]: unknown};

export interface ApiGatewayObject {
    service_account_id?: string;
    service_account?: string;
}

export enum IntegrationType {
    dummy = 'dummy',
    cloud_functions = 'cloud_functions',
    _cloud_functions = 'cloud-functions',
    http = 'http',
    object_storage = 'object_storage',
    _object_storage = 'object-storage',
    cloud_datasphere = 'cloud_datasphere',
    serverless_containers = 'serverless_containers',
    cloud_ymq = 'cloud_ymq',
    cloud_datastreams = 'cloud_datastreams',
}

interface BaseIntegrationObject {
    type: IntegrationType;
}

export interface DummyIntegrationObject extends BaseIntegrationObject {
    type: IntegrationType.dummy;
    /**
     * HTTP response code
     *
     * @minimum 100
     * @maximum 599
     * @TJS-type integer
     */
    http_code: number;
    /**
     * List of headers to be sent in response. Parameters are substituted in `http_headers`.
     */
    http_headers: {[header: string]: string | string[]};
    /**
     * Data to be sent in response.
     * Can be either real content or mapping from the requested `Content-Type` into data.
     * This lets you send errors in the requested format: JSON or XML.
     * The `*` key is used for the default value. Parameters are substituted in `content`.
     */
    content: {[header: string]: string};
}

export interface HttpIntegrationTimeouts {
    /**
     * @minimum 0
     */
    read: number;
    /**
     * @minimum 0
     */
    connect: number;
}

export interface HttpIntegrationsObject extends BaseIntegrationObject {
    type: IntegrationType.http;
    /**
     * URL to redirect the invocation to (must be accessible from the internet). Parameters are substituted in `url`.
     */
    url: string;
    /**
     * Optional parameter. HTTP method used for the invocation. If the parameter is omitted, it defaults to the method of request to API Gateway.
     */
    method: HttpMethods.GET | HttpMethods.POST | HttpMethods.PUT | HttpMethods.PATCH | HttpMethods.DELETE;
    /**
     * HTTP headers to be passed. Original request headers are not passed. Parameters are substituted in `headers`.
     */
    headers: {[header: string]: string};
    /**
     * Optional parameter. The `read` and `connect` invocation timeouts, in seconds.
     */
    timeouts: HttpIntegrationTimeouts;

}

export interface FunctionIntegrationObject extends BaseIntegrationObject {
    type: IntegrationType.cloud_functions | IntegrationType._cloud_functions;
    /**
     * Function ID.
     */
    function_id: string;
    /**
     * Optional parameter. Version tag. The default value is `$latest`. Parameters are substituted in tag.
     */
    tag?: '$latest' | string;
    /**
     * Function call format version. Legal values: 0.1 and 1.0. Default version: 0.1.
     */
    payload_format_version?: PayloadFormatVersion;
    /**
     * Optional parameter. Operation context is an arbitrary object in YAML or JSON format. Passed to a function inside a request using the `requestContext.apiGateway.operationContext` field. Parameter substitution takes place in `context`.
     */
    context?: object;
    /**
     * Service account ID used for authorization when accessing a container. If the parameter is omitted, the value of the top-level `service_account_id` parameter is used.
     */
    service_account_id?: string;
}

export interface DatasphereIntegrationObject extends BaseIntegrationObject {
    type: IntegrationType.cloud_datasphere;
    /**
     * ID of the folder containing the created DataSphere project and the deployed node.
     */
    folder_id: string;
    /**
     * DataSphere node ID.
     */
    node_id: string;
    /**
     * ID of the service account. Used for authorization when calling a DataSphere node. If you omit the parameter, the value used is that of the top-level parameter called `service_account_id`.
     */
    service_account_id?: string;

}

export interface ContainerIntegrationObject extends BaseIntegrationObject {
    type: IntegrationType.serverless_containers;
    /**
     * Container ID.
     */
    container_id: string;
    /**
     * Optional parameter. Operation context is an arbitrary object in YAML or JSON format. Encoded in Base64 and passed to the container in the `X-Yc-ApiGateway-Operation-Context` header. `context` is where parameter substitution takes place.
     */
    context?: object;
    /**
     * Service account ID used for authorization when accessing a container. If the parameter is omitted, the value of the top-level `service_account_id` parameter is used.
     */
    service_account_id?: string;
}

export interface S3IntegrationObject extends BaseIntegrationObject {
    type: IntegrationType.object_storage | IntegrationType._object_storage;
    /**
     * Name of the bucket.
     */
    bucket: string;
    /**
     * Object name. Supports parameter standardization from the path of the original request. Parameters are substituted in `object`.
     */
    object: string;

    /**
     * Optional parameter. Object name returned if HTTP error code 4xx is received instead of object.
     */
    error_object?: string;
    /**
     * If the value is true, a pre-signed URL is generated and a redirect is returned to the client.
     */
    presigned_redirect?: boolean;
    /**
     * Service account ID used for authorization when accessing a container. If the parameter is omitted, the value of the top-level `service_account_id` parameter is used.
     */
    service_account_id?: string;
}


export interface YmqIntegrationObject extends BaseIntegrationObject {
    type: IntegrationType.cloud_ymq;
    /**
     * The type of operation to perform.
     */
    action: 'SendMessage';
    /**
     * Queue address.
     */
    queue_url: string;

    /**
     * ID of the folder containing the queue.
     */
    folder_id: string;
    /**
     * The number of seconds to delay the message from being available for processing.
     * @minimum 0
     * @TJS-type integer
     */
    delay_seconds: number;
    /**
     * ID of the service account. Used for authorization when performing a queue operation. If you omit the parameter, the value used is that of the top-level parameter `service_account_id`.
     */
    service_account_id?: string;
}

export interface DatastreamIntegrationObject extends BaseIntegrationObject {
    type: IntegrationType.cloud_datastreams;
    /**
     * The type of operation to perform.
     */
    action: 'PutRecord';
    /**
     * Data Streams stream name.
     */
    stream_name: string;

    /**
     * Shard key. `partition_key` is where parameter substitution takes place.
     */
    partition_key: string;

    /**
     * ID of the service account. Used for authorization when performing Data Streams stream operations. If you omit the parameter, the value used is that of the top-level parameter called `service_account_id`.
     */
    service_account_id?: string;
}


export type ApiGatewayIntegrationObject = S3IntegrationObject |
    ContainerIntegrationObject |
    DatasphereIntegrationObject |
    FunctionIntegrationObject |
    DummyIntegrationObject |
    HttpIntegrationsObject |
    YmqIntegrationObject |
    DatastreamIntegrationObject;

export enum AuthorizerType {
    function = 'function',
    jwt = 'jwt',
    iam = 'iam',
}

export interface AuthorizerObject {
    type: AuthorizerType;
    /**
     * Function ID.
     */
    function_id: string;
    /**
     * Optional parameter. Version tag. Default value: `$latest`. Parameters are substituted in `tag`.
     */
    tag: string;
    /**
     * ID of the service account. Used for authorization when invoking a function. If you omit the parameter, the value used is that of the top-level parameter `service_account_id`. If there is no top-level parameter, the function is invoked without authorization.
     */
    service_account_id: string;
    /**
     * Optional parameter. A time limit on keeping the function response stored in the local API Gateway cache. If the parameter is omitted, the response is not cached.
     * @minimum 0
     * @TJS-type integer
     */
    authorizer_result_ttl_in_seconds?: number;
}


export type YcPathItemObject<T> = OpenAPIV3.PathItemObject<{'x-yc-apigateway-integration': ApiGatewayIntegrationObject;} & T>

export interface YcPathsObject<T extends {} = {}, P extends {} = {}> {
    [pattern: string]: (YcPathItemObject<T> & P) | undefined;
}

export interface YcOpenAPI3 extends OpenAPIV3.Document {
    paths: YcPathsObject;
}


export interface MessageQueueInfo {
    id: string;
    name: string;
    url: string;
}

export interface AttachedDomain {
    domainId: string;
    certificateId: string;
    enabled: boolean;
    domain: string;
}

export interface ApiGatewayInfo {
    id?: string;
    name: string;
    domains?: AttachedDomain[];
    openapiSpec?: string;
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

export enum HttpMethodAliases {
    GET = 'get',
    PUT = 'put',
    POST = 'post',
    DELETE = 'delete',
    OPTIONS = 'options',
    HEAD = 'head',
    PATCH = 'patch',
    TRACE = 'trace',
    ANY = 'any'
}

export type HttpMethodAlias =
    HttpMethodAliases.GET
    | HttpMethodAliases.PUT
    | HttpMethodAliases.POST
    | HttpMethodAliases.DELETE
    | HttpMethodAliases.OPTIONS
    | HttpMethodAliases.HEAD
    | HttpMethodAliases.PATCH
    | HttpMethodAliases.TRACE
    | HttpMethodAliases.ANY;

type Parameters = {[param: string]: boolean}
export type RequestParameters = {
    querystrings?: Parameters,
    headers?: Parameters,
    paths?: Parameters,
}

export interface ApiGatewayEvent {
    http:
        | string
        | {
        path: string;
        method: HttpMethodAlias;
        authorizer?: any;
        cors?: any;
        integration?: string | undefined;
        eventFormat?: PayloadFormatVersion.V0 | PayloadFormatVersion.V1,
        request?: {
            parameters?: RequestParameters;
        },
        context?: object,
        schemas?: {[schema: string]: string | object}
    };
}

export type Event = ApiGatewayEvent;

export interface ServerlessFunc {
    account: string;
    handler: string;
    name?: string | undefined;
    package?: Package | undefined;
    reservedConcurrency?: number | undefined;
    runtime?: string | undefined;
    timeout?: number | undefined;
    memorySize?: number | undefined;
    environment?: {[name: string]: string} | undefined;
    events: Event[];
    tags?: {[key: string]: string} | undefined;
}

export enum TriggerType {
    CRON = 'cron',
    S3 = 's3',
    YMQ = 'ymq',
    CR = 'cr',
}

export enum EventType {
    HTTP = 'http',
}
