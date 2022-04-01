import Serverless from 'serverless';
import ServerlessPlugin from 'serverless/classes/Plugin';

import { YandexCloudProvider } from '../provider/provider';

export class YandexCloudInvoke implements ServerlessPlugin {
    private readonly serverless: Serverless;
    private readonly options: Serverless.Options;
    private readonly provider: YandexCloudProvider;

    hooks: ServerlessPlugin.Hooks;

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
            this.serverless.cli.log(`Function "${this.options.function}" not found`);

            return;
        }

        const result = await this.provider.invokeFunction(toInvoke[0].id);

        this.serverless.cli.log(JSON.stringify(result));
    }
}
