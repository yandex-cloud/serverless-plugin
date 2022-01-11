import Serverless from 'serverless';

import { YandexCloudProvider } from '../provider/provider';
import { YandexCloudDeploy } from '../deploy/deploy';

type TriggerType = 'cron' | 's3' | 'ymq' | 'cr';

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
    }
}

interface CrTriggerState extends BaseTriggerState {
    type: 'cr';
    params: {
        account: string;
        registryId: string;
        registry: string;
        dlq?: string;
        dlqId?: string;
        dlqAccountId?: string;
        dlqAccount?: string;
    }
}

type TriggerState = CrTriggerState | YmqTriggerState | S3TriggerState | CronTriggerState;

export class Trigger {
    private readonly provider: YandexCloudProvider;
    private readonly serverless: Serverless;
    private readonly initialState?: TriggerState;
    private readonly deploy: YandexCloudDeploy;

    private newState?: TriggerState;

    public id?: string;

    constructor(serverless: Serverless, deploy: YandexCloudDeploy, initial?: TriggerState) {
        this.provider = serverless.getProvider('yandex-cloud') as YandexCloudProvider;
        this.serverless = serverless;
        this.initialState = initial;
        this.deploy = deploy;
    }

    setNewState(newState: TriggerState) {
        this.newState = newState;
    }

    private creators() {
        return {
            cron: this.provider.createCronTrigger,
            s3: this.provider.createS3Trigger,
            ymq: this.provider.createYMQTrigger,
            cr: this.provider.createCRTrigger,
        };
    }

    async sync() {
        if (!this.initialState?.id) {
            this.serverless.cli.log('Trigger id is not defined');

            return;
        }

        if (!this.newState) {
            try {
                await this.provider.removeTrigger(this.initialState.id);

                this.serverless.cli.log(`Trigger removed "${this.initialState.name}"`);
            } catch (error) {
                this.serverless.cli.log(`${error}\nFailed to remove trigger "${this.initialState.name}"`);
            }

            return;
        }

        if (this.initialState) {
            try {
                await this.provider.removeTrigger(this.initialState.id);
                this.serverless.cli.log(`Trigger removed "${this.initialState.name}"`);
            } catch (error) {
                this.serverless.cli.log(`${error}\nFailed to remove trigger "${this.initialState.name}"`);
            }
        }

        const triggerName = `${this.newState.function.name}-${this.newState.type}`;

        if (!this.newState.function.name) {
            this.serverless.cli.log('Function name is not defined');

            return;
        }

        try {
            const response = await this.creators()[this.newState.type]({
                name: triggerName,
                queueServiceAccount: this.queueServiceAccount(),
                queueId: this.queueId(),
                functionId: this.deploy.getFunctionId(this.newState.function.name),
                serviceAccount: this.deploy.getServiceAccountId(this.newState.params.account),
                dlqId: this.dlqId(),
                dlqAccountId: this.dlqServiceAccount(),
                registryId: this.crId(),
                ...this.newState.params,
            });

            this.id = response.id;
            this.serverless.cli.log(`Trigger created "${triggerName}"`);
        } catch (error) {
            this.serverless.cli.log(`${error}
      Failed to create trigger "${triggerName}"`);
        }
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

    static supportedTriggers(): TriggerType[] {
        return ['cron', 's3', 'ymq', 'cr'];
    }

    static normalizeEvent(event: Serverless.Event) {
        // @ts-ignore
        const foundTriggerType = Trigger.supportedTriggers().find((type) => event[type]);

        // @ts-ignore
        return foundTriggerType && event[foundTriggerType];
    }
}
