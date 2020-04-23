'use strict';

class YandexCloudInvoke {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('yandex-cloud');

        this.hooks = {
            'invoke:invoke': async () => {
                await this.invoke();
            },
        };
    }

    async invoke() {
        const currentFunctions = await this.provider.getFunctions();
        const describedFunctions = this.serverless.service.functions;
        const toInvoke = currentFunctions.filter((currFunc) => {
            return Object.keys(describedFunctions).find((funcKey) => {
                return describedFunctions[funcKey].name === currFunc.name && funcKey === this.options.function;
            });
        });

        if (toInvoke.length !== 1) {
            this.serverless.cli.log(`Function "${this.options.function}" not found`);
            return;
        }
        const result = await this.provider.invokeFunction(toInvoke[0].id);
        this.serverless.cli.log(JSON.stringify(result));
    }
}

module.exports = YandexCloudInvoke;
