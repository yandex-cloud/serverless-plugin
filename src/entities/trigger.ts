import { YandexCloudProvider } from '../provider/provider';
import { YandexCloudDeploy } from '../deploy/deploy';
import { TriggerInfo, TriggerType } from '../types/common';
import { log } from '../utils/logging';
import Serverless from '../types/serverless';
import { Event } from '../types/events';

interface RetryOptions {
    attempts: number;
    interval: number;
}

interface BaseTriggerState {
    id?: string;
    name?: string;
    function: {
        name?: string;
    };
}

interface CronTriggerState extends BaseTriggerState {
    type: 'cron';
    params: {
        account: string;
        expression: string;
        retry?: RetryOptions,
        dlq?: string;
        dlqId?: string;
        dlqAccountId?: string;
        dlqAccount?: string;
    };
}

interface S3TriggerState extends BaseTriggerState {
    type: 's3';
    params: {
        account: string;
        events: string[];
        bucket: string;
        prefix?: string;
        suffix?: string;
        retry?: RetryOptions,
        dlq?: string;
        dlqId?: string;
        dlqAccountId?: string;
        dlqAccount?: string;
    };
}

interface YmqTriggerState extends BaseTriggerState {
    type: 'ymq';
    params: {
        account: string;
        queueId: string;
        queue: string;
        queueAccount: string;
        retry: RetryOptions,
        batch?: number,
        cutoff?: number,
    };
}

interface YdsTriggerState extends BaseTriggerState {
    type: 'yds';
    params: {
        stream: string;
        database: string;
        streamServiceAccount: string;
        account: string;
        retry: RetryOptions,
        batch?: number,
        cutoff?: number,
        dlq?: string;
        dlqId?: string;
        dlqAccountId?: string;
        dlqAccount?: string;
    };
}

interface CrTriggerState extends BaseTriggerState {
    type: 'cr';
    params: {
        events: string[];
        account: string;
        registryId?: string;
        registry: string;
        imageName: string;
        tag: string;
        dlq?: string;
        dlqId?: string;
        dlqAccountId?: string;
        dlqAccount?: string;
        retry: RetryOptions,
    };
}

type TriggerState = CrTriggerState | YmqTriggerState | YdsTriggerState | S3TriggerState | CronTriggerState;

export class Trigger {
    public id?: string;
    private readonly provider: YandexCloudProvider;
    private readonly serverless: Serverless;
    private readonly initialState?: TriggerInfo;
    private readonly deploy: YandexCloudDeploy;
    private newState?: TriggerState;

    constructor(serverless: Serverless, deploy: YandexCloudDeploy, initial?: TriggerInfo) {
        this.provider = serverless.getProvider('yandex-cloud') as YandexCloudProvider;
        this.serverless = serverless;
        this.initialState = initial;
        this.deploy = deploy;
    }

    static supportedTriggers(): TriggerType[] {
        return [TriggerType.CRON, TriggerType.S3, TriggerType.YMQ, TriggerType.CR, TriggerType.YDS];
    }

    static normalizeEvent(event: Event) {
        // @ts-ignore
        const foundTriggerType = Trigger.supportedTriggers().find((type) => event[type]);

        // @ts-ignore
        return foundTriggerType && { type: foundTriggerType, params: event[foundTriggerType] };
    }

    setNewState(newState: TriggerState) {
        this.newState = newState;
    }

    async sync() {
        if (!this.newState) {
            if (!this.initialState?.id) {
                log.info('Trigger id is not defined');

                return;
            }

            await this.provider.removeTrigger(this.initialState.id);
            log.success(`Trigger removed "${this.initialState.name}"`);

            return;
        }

        if (this.initialState) {
            if (!this.initialState?.id) {
                log.error('Trigger id is not defined');

                return;
            }

            await this.provider.removeTrigger(this.initialState.id);
            log.success(`Trigger removed "${this.initialState.name}"`);
        }

        const triggerName = `${this.newState.function.name}-${this.newState.type}`;

        if (!this.newState.function.name) {
            throw new Error('Function name is not defined');
        }

        const response = await this.creators()[this.newState.type]({
            name: triggerName,
            streamServiceAccount: this.streamServiceAccount(),
            queueServiceAccount: this.queueServiceAccount(),
            queueId: this.queueId(),
            functionId: this.deploy.getFunctionId(this.newState.function.name),
            serviceAccount: this.deploy.getServiceAccountId(this.newState.params.account),
            dlqId: this.dlqId(),
            dlqAccountId: this.dlqServiceAccount(),
            registryId: this.crId(),
            ...this.newState.params,
        });

        this.id = response?.id;
        log.success(`Trigger created "${triggerName}"`);
    }

    streamServiceAccount() {
        return this.newState?.type === 'yds' ? this.deploy.getServiceAccountId(this.newState.params.streamServiceAccount) : undefined;
    }

    queueServiceAccount() {
        return this.newState?.type === 'ymq' ? this.deploy.getServiceAccountId(this.newState.params.queueAccount) : undefined;
    }

    queueId() {
        let qId: string | undefined;

        if (this.newState?.type === 'ymq') {
            qId = this.newState?.params.queueId
                ? this.newState.params.queueId
                : this.deploy.getMessageQueueId(this.newState.params.queue);
        }

        return qId;
    }

    dlqId() {
        let dlqId: string | undefined;

        if (this.newState?.type !== 'ymq') {
            dlqId = this.newState?.params.dlqId || (this.newState?.params.dlq && this.deploy.getMessageQueueId(this.newState.params.dlq));
        }

        return dlqId;
    }

    dlqServiceAccount() {
        let dlqSaId: string | undefined;

        if (this.newState?.type !== 'ymq') {
            dlqSaId = this.newState?.params.dlqAccountId
                || (this.newState?.params.dlqAccount && this.deploy.getServiceAccountId(this.newState?.params.dlqAccount));
        }

        return dlqSaId;
    }

    crId() {
        let crId: string | undefined;

        if (this.newState?.type === 'cr') {
            crId = this.newState.params.registryId
                ? this.newState.params.registryId
                : this.deploy.getContainerRegistryId(this.newState.params.registry);
        }

        return crId;
    }

    private creators() {
        return {
            cron: this.provider.createCronTrigger,
            s3: this.provider.createS3Trigger,
            ymq: this.provider.createYMQTrigger,
            cr: this.provider.createCRTrigger,
            yds: this.provider.createYDSTrigger,
        };
    }
}
