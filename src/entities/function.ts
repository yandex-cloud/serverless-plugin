import { AWSError } from 'aws-sdk/lib/error';
import fs from 'node:fs';
import path from 'path';
import { YandexCloudDeploy } from '../deploy/deploy';
import { YandexCloudProvider } from '../provider/provider';
import {
    CodeOrPackage,
    UpdateFunctionRequest,
} from '../provider/types';
import { ServerlessFunc } from '../types/common';
import Serverless from '../types/serverless';
import { humanFileSize } from '../utils/formatting';
import {
    log,
    progress,
} from '../utils/logging';

export const MAX_PACKAGE_SIZE = 128 * 1024 * 1024; // 128MB
export const MAX_PACKAGE_SIZE_FOR_DIRECT_UPLOAD = 3.5 * 1024 * 1024; // 3.5MB

interface FunctionState {
    id: string;
    name: string;
}

interface FunctionNewState {
    params: ServerlessFunc;
    name: string;
}

export class YCFunction {
    public id?: string;
    private readonly serverless: Serverless;
    private readonly deploy: YandexCloudDeploy;
    private readonly initialState?: FunctionState;
    private newState?: FunctionNewState;

    constructor(serverless: Serverless, deploy: YandexCloudDeploy, initial?: FunctionState) {
        this.serverless = serverless;
        this.deploy = deploy;
        this.initialState = initial;
        this.id = initial?.id;
    }

    private static validateEnvironment(environment: Record<string, string> | undefined, provider: YandexCloudProvider) {
        let result = true;

        if (!environment) {
            return result;
        }
        for (const [k, v] of Object.entries(environment)) {
            if (!/^[A-Za-z]\w*$/.test(k)) {
                log.error(`Environment variable "${k}" name does not match with "[a-zA-Z][a-zA-Z0-9_]*"`);
                result = false;
            }
            if (typeof v !== 'string') {
                log.error(`Environment variable "${k}" value is not string`);
                result = false;
                continue;
            }
            if (v.length > 4096) {
                log.error(`Environment variable "${k}" value is too long`);
                result = false;
            }
        }

        return result;
    }

    getNewState(): FunctionNewState | undefined {
        return this.newState;
    }

    setNewState(newState: FunctionNewState) {
        this.newState = newState;
    }

    async prepareArtifact(): Promise<CodeOrPackage> {
        const provider = this.serverless.getProvider('yandex-cloud');
        const { artifact } = this.serverless.service.package;
        const artifactStat = fs.statSync(artifact);

        if (artifactStat.size >= MAX_PACKAGE_SIZE) {
            throw new Error(`Artifact size ${humanFileSize(artifactStat.size)} exceeds Maximum Package Size of 128MB`);
        } else if (artifactStat.size >= MAX_PACKAGE_SIZE_FOR_DIRECT_UPLOAD) {
            log.warning(`Artifact size ${humanFileSize(artifactStat.size)} exceeds Maximum Package Size for direct upload of 3.5MB.`);
            const providerConfig = this.serverless.service.provider;
            const bucketName = providerConfig.deploymentBucket ?? provider.getServerlessDeploymentBucketName();
            const prefix = providerConfig.deploymentPrefix ?? 'serverless';

            try {
                await provider.checkS3Bucket(bucketName);
            } catch (error) {
                const awsErr = error as AWSError;

                if (awsErr.statusCode === 404) {
                    log.info(`No bucket ${bucketName}.`);
                    await provider.createS3Bucket({ name: bucketName });
                }
            }
            const objectName = path.join(prefix, path.basename(artifact));

            await provider.putS3Object({
                Bucket: bucketName,
                Key: objectName,
                Body: fs.readFileSync(artifact),
            });

            return {
                package: {
                    bucketName,
                    objectName,
                },
            };
        } else {
            return {
                code: artifact,
            };
        }
    }

    async sync() {
        const provider = this.serverless.getProvider('yandex-cloud');

        if (!this.newState) {
            log.info(`Unknown function "${this.initialState?.name}" found`);

            return;
        }

        if (!YCFunction.validateEnvironment(this.newState.params.environment, provider)) {
            throw new Error('Invalid environment');
        }

        if (!this.serverless.service.provider.runtime) {
            throw new Error('Provider\'s runtime is not defined');
        }

        const progressReporter = progress.create({});

        const artifact = await this.prepareArtifact();

        if (this.initialState) {
            const requestParams: UpdateFunctionRequest = {
                ...this.newState.params,
                runtime: this.serverless.service.provider.runtime,
                artifact,
                id: this.initialState.id,
                serviceAccount: this.deploy.getServiceAccountId(this.newState.params.account),
            };

            await provider.updateFunction(requestParams, progressReporter);
            progressReporter.remove();

            log.success(`Function updated\n${this.newState.name}: ${requestParams.name}`);

            return;
        }

        const requestParams = {
            ...this.newState.params,
            runtime: this.serverless.service.provider.runtime,
            artifact,
            serviceAccount: this.deploy.getServiceAccountId(this.newState.params.account),
        };
        const response = await provider.createFunction(requestParams, progressReporter);

        progressReporter.remove();

        this.id = response.id;
        log.success(`Function created\n${this.newState.name}: ${requestParams.name}`);
    }
}
