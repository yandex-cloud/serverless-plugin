import ServerlessPlugin from 'serverless/classes/Plugin';

import { YandexCloudProvider } from '../provider/provider';
import { log, writeText } from '../utils/logging';
import Serverless from '../types/serverless';

export class YandexCloudInvoke implements ServerlessPlugin {
    hooks: ServerlessPlugin.Hooks;
    private readonly serverless: Serverless;
    private readonly options: Serverless.Options;
    private readonly provider: YandexCloudProvider;

    constructor(serverless: Serverless, options: Serverless.Options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('yandex-cloud') as YandexCloudProvider;

        this.hooks = {
            'invoke:invoke': async () => {
                await this.invoke();
            },
        };
    }

    async invoke() {
        const currentFunctions = await this.provider.getFunctions();
        const describedFunctions = this.serverless.service.functions;
        const toInvoke = currentFunctions.filter((currFunc) => Object.keys(describedFunctions)
            .find((funcKey) => describedFunctions[funcKey].name === currFunc.name && funcKey === this.options.function));

        if (toInvoke.length !== 1) {
            log.notice(`Function "${this.options.function}" not found`);

            return;
        }

        const result = await this.provider.invokeFunction(toInvoke[0].id);

        writeText(JSON.stringify(result));
    }
}
