export interface MessageQueueInfo {
    // TODO: make required after migration to yandex-cloud@2.X
    id?: string;
    name: string;
    url: string;
}

export interface FunctionInfo {
    // TODO: make required after migration to yandex-cloud@2.X
    id?: string;
    // TODO: make required after migration to yandex-cloud@2.X
    name?: string;
}

export interface TriggerInfo {
    // TODO: make required after migration to yandex-cloud@2.X
    id?: string;
    // TODO: make required after migration to yandex-cloud@2.X
    name?: string;
}

export interface ServiceAccountInfo {
    // TODO: make required after migration to yandex-cloud@2.X
    id?: string;
    // TODO: make required after migration to yandex-cloud@2.X
    name?: string;
    roles: string[];
}

export interface S3BucketInfo {
    // TODO: make required after migration to yandex-cloud@2.X
    name?: string;
}
