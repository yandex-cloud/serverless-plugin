/* eslint-disable @typescript-eslint/no-misused-new */
import Serverless from './serverless';
import Plugin from './plugin';

export default interface PluginManager {
    cliOptions: Record<string, unknown>;
    cliCommands: Record<string, unknown>;
    serverless: Serverless;
    plugins: Plugin[];
    commands: Record<string, unknown>;
    hooks: Record<string, unknown>;
    deprecatedEvents: Record<string, unknown>;

    new(serverless: Serverless): PluginManager;

    setCliOptions(options: Serverless.Options): void;

    setCliCommands(commands: Record<string, unknown>): void;

    addPlugin(plugin: Plugin.PluginStatic): void;

    loadAllPlugins(servicePlugins: Record<string, unknown>): void;

    loadPlugins(plugins: Record<string, unknown>): void;

    loadCorePlugins(): void;

    loadServicePlugins(servicePlugins: Record<string, unknown>): void;

    loadCommand(pluginName: string, details: Record<string, unknown>, key: string): Record<string, unknown>;

    loadCommands(pluginInstance: Plugin): void;

    spawn(commandsArray: string | string[], options?: any): Promise<void>;
}
