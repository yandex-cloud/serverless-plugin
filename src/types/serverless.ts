import PluginManager from './plugin-manager';
// import AwsProvider = require('serverless/plugins/aws/provider/awsProvider');
import Service from './service';
import { YandexCloudProvider } from '../provider/provider';
import Utils = require('serverless/classes/Utils');
import YamlParser = require('serverless/classes/YamlParser');
import { Event } from './events';


declare namespace Serverless {
    interface Options {
        function?: string | undefined;
        watch?: boolean | undefined;
        verbose?: boolean | undefined;
        extraServicePath?: string | undefined;
        stage: string | null;
        region: string | null;
        noDeploy?: boolean | undefined;
    }

    interface Config {
        servicePath: string;
    }

    interface FunctionDefinition {
        name?: string | undefined;
        package?: Package | undefined;
        reservedConcurrency?: number | undefined;
        runtime?: string | undefined;
        timeout?: number | undefined;
        memorySize?: number | undefined;
        environment?: { [name: string]: string } | undefined;
        events: Event[];
        tags?: { [key: string]: string } | undefined;
    }

    interface LogOptions {
        color?: string | undefined;
        bold?: boolean | undefined;
        underline?: boolean | undefined;
        entity?: string | undefined;
    }

    interface FunctionDefinitionHandler extends FunctionDefinition {
        handler: string;
    }

    interface FunctionDefinitionImage extends FunctionDefinition {
        image: string;
    }

    interface Package {
        /** @deprecated use `patterns` instead */
        include?: string[] | undefined;
        /** @deprecated use `patterns` instead */
        exclude?: string[] | undefined;
        patterns?: string[] | undefined;
        artifact?: string | undefined;
        individually?: boolean | undefined;
    }

}

declare class Serverless {
    cli: {
        /**
         * @deprecated starting from Serverless V3, this method is deprecated, see https://www.serverless.com/framework/docs/guides/plugins/cli-output
         */
        log(message: string, entity?: string, options?: Serverless.LogOptions): null;
    };
    providers: {};
    utils: Utils;
    variables: {
        populateService(): Promise<any>;
    };
    yamlParser: YamlParser;
    pluginManager: PluginManager;
    config: Serverless.Config;
    serverlessDirPath: string;
    service: Service;
    version: string;
    resources: object;
    configSchemaHandler: {
        defineCustomProperties(schema: unknown): void;
        defineFunctionEvent(provider: string, event: string, schema: Record<string, unknown>): void;
        defineFunctionEventProperties(provider: string, existingEvent: string, schema: unknown): void;
        defineFunctionProperties(provider: string, schema: unknown): void;
        defineProvider(provider: string, options?: Record<string, unknown>): void;
        defineTopLevelProperty(provider: string, schema: Record<string, unknown>): void;
    };

    constructor(config?: {});

    init(): Promise<any>;

    run(): Promise<any>;

    setProvider(name: 'yandex-cloud', provider: YandexCloudProvider): null;

    getProvider(name: 'yandex-cloud'): YandexCloudProvider;

    getVersion(): string;
}

export = Serverless;
