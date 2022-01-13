/* eslint-disable import/no-import-module-exports */
import Serverless from 'serverless';

import { YandexCloudProvider } from './provider/provider';
import { YandexCloudDeploy } from './deploy/deploy';
import { YandexCloudRemove } from './remove/remove';
import { YandexCloudInvoke } from './invoke/invoke';
import { YandexCloudInfo } from './info/info';
import { YandexCloudLogs } from './logs/logs';

class YandexCloudServerlessPlugin {
    private readonly serverless: Serverless;
    private readonly options: Serverless.Options;

    constructor(serverless: Serverless, options: Serverless.Options) {
        this.serverless = serverless;
        this.options = options;

        this.serverless.pluginManager.addPlugin(YandexCloudProvider);
        this.serverless.pluginManager.addPlugin(YandexCloudDeploy);
        this.serverless.pluginManager.addPlugin(YandexCloudRemove);
        this.serverless.pluginManager.addPlugin(YandexCloudInvoke);
        this.serverless.pluginManager.addPlugin(YandexCloudInfo);
        this.serverless.pluginManager.addPlugin(YandexCloudLogs);
    }
}

// eslint-disable-next-line unicorn/prefer-module
module.exports = YandexCloudServerlessPlugin;
