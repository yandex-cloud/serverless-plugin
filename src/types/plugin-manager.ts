import Serverless from './serverless';
import Plugin from './plugin';

export default interface PluginManager {
    cliOptions: {};
    cliCommands: {};
    serverless: Serverless;
    plugins: Plugin[];
    commands: {};
    hooks: {};
    deprecatedEvents: {};

    new(serverless: Serverless): PluginManager;

    setCliOptions(options: Serverless.Options): void;

    setCliCommands(commands: {}): void;

    addPlugin(plugin: Plugin.PluginStatic): void;

    loadAllPlugins(servicePlugins: {}): void;

    loadPlugins(plugins: {}): void;

    loadCorePlugins(): void;

    loadServicePlugins(servicePlugins: {}): void;

    loadCommand(pluginName: string, details: {}, key: string): {};

    loadCommands(pluginInstance: Plugin): void;

    spawn(commandsArray: string | string[], options?: any): Promise<void>;
}

