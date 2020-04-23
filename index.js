'use strict';

const YandexCloudProvider = require('./lib/provider/provider');

const YandexCloudDeploy = require('./lib/deploy/deploy');
const YandexCloudRemove = require('./lib/remove/remove');
const YandexCloudInvoke = require('./lib/invoke/invoke');
const YandexCloudInfo = require('./lib/info/info');

class YandexCloudServerlessPlugin {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;

        this.serverless.pluginManager.addPlugin(YandexCloudProvider);
        this.serverless.pluginManager.addPlugin(YandexCloudDeploy);
        this.serverless.pluginManager.addPlugin(YandexCloudRemove);
        this.serverless.pluginManager.addPlugin(YandexCloudInvoke);
        this.serverless.pluginManager.addPlugin(YandexCloudInfo);
    }
}

module.exports = YandexCloudServerlessPlugin;
