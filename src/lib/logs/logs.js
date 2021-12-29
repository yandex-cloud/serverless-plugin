'use strict';

class YandexCloudLogs {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('yandex-cloud');

        this.hooks = {
            'logs:logs': async () => {
                await this.logs();
            },
        };
    }

    async logs() {
        const currentFunctions = await this.provider.getFunctions();
        const describedFunctions = this.serverless.service.functions;
        const toLog = currentFunctions.filter((currFunc) => {
            return Object.keys(describedFunctions).find((funcKey) => {
                return describedFunctions[funcKey].name === currFunc.name && funcKey === this.options.function;
            });
        });

        if (toLog.length !== 1) {
            return;
        }
        const result = await this.provider.getFunctionLogs(toLog[0].id);
        this.serverless.cli.log(JSON.stringify(result));
    }
}

module.exports = YandexCloudLogs;
