import Serverless from 'serverless';
import ServerlessPlugin from 'serverless/classes/Plugin';
import { YandexCloudProvider } from '../provider/provider';
import { writeText } from '../utils/logging';

export class YandexCloudLogs implements ServerlessPlugin {
    hooks: ServerlessPlugin.Hooks;
    private readonly serverless: Serverless;
    private readonly options: Serverless.Options;
    private readonly provider: YandexCloudProvider;

    constructor(serverless: Serverless, options: Serverless.Options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('yandex-cloud') as YandexCloudProvider;

        this.hooks = {
            'logs:logs': async () => {
                await this.logs();
            },
        };
    }

    async logs() {
        const currentFunctions = await this.provider.getFunctions();
        const describedFunctions = this.serverless.service.functions;
        const toLog = currentFunctions.filter((currFunc) => Object.keys(describedFunctions)
            .find((funcKey) => describedFunctions[funcKey].name === currFunc.name && funcKey === this.options.function));

        if (toLog.length !== 1) {
            return;
        }

        const result = await this.provider.getFunctionLogs(toLog[0].id);

        writeText(JSON.stringify(result));
    }
}
