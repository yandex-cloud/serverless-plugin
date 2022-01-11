import Serverless from 'serverless';

import { YandexCloudProvider } from './provider/provider';
import { YandexCloudDeploy } from './deploy/deploy';
import YandexCloudRemove from './lib/remove/remove';
import YandexCloudInvoke from './lib/invoke/invoke';
import { YandexCloudInfo } from './info/info';

export default class YandexCloudServerlessPlugin {
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
    }
}
