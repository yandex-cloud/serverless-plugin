import ServerlessPlugin from 'serverless/classes/Plugin';
import { bind } from 'bind-decorator';
import Serverless from '../types/serverless';
import { log } from '../utils/logging';
import { YandexCloudProvider } from '../provider/provider';

interface ConfigVariableResolveRequest {
    address: string;
}

export class YandexCloudLockbox implements ServerlessPlugin {
    hooks: ServerlessPlugin.Hooks = {};

    private readonly serverless: Serverless;
    private readonly options: Serverless.Options;
    private provider: YandexCloudProvider;
    configurationVariablesSources?: ServerlessPlugin.ConfigurationVariablesSources;

    constructor(serverless: Serverless, options: Serverless.Options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('yandex-cloud');

        this.configurationVariablesSources = {
            lockbox: {
                resolve: this.resolveLockboxVariable,
            },
        };
    }

    @bind
    private async resolveLockboxVariable(request: ConfigVariableResolveRequest) {
        const addressParts = request.address.split('/');

        if (addressParts.length !== 2) {
            // eslint-disable-next-line no-template-curly-in-string
            throw new Error('Invalid variable declaration. Use following format: ${lockbox:<secret_id>/<key>}');
        }

        const secretId = addressParts[0];
        const secretKey = addressParts[1];

        try {
            const secretPayload = await this.provider.getLockboxSecretKey(secretId);
            const secretValue = secretPayload[secretKey];

            if (!secretValue) {
                throw new Error(`Secret doesn't contain key ${secretKey} or it has empty text value`);
            }

            return { value: secretValue };
        } catch (error: unknown) {
            log.error(`Unable to get content of secret key from lockbox: ${error}`);

            throw error;
        }
    }
}
