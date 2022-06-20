import path from 'path';
import yaml from 'yaml';
import fs from 'fs';
import * as os from 'os';
import { getEnv } from './get-env';
import { log } from './logging';

interface YcConfigBase {
    cloudId: string;
    folderId: string;
}

interface YcConfigOauth extends YcConfigBase {
    token: string;
}

interface YcConfigIam extends YcConfigBase {
    iamToken: string;
}

type YcConfig = YcConfigOauth | YcConfigIam;

const YC_OAUTH_TOKEN_ENV = 'YC_OAUTH_TOKEN';
const YC_IAM_TOKEN_ENV = 'YC_IAM_TOKEN';
const YC_CLOUD_ID = 'YC_CLOUD_ID';
const YC_FOLDER_ID = 'YC_FOLDER_ID';
const YC_CONFIG_PATH = path.join(os.homedir(), '.config/yandex-cloud/config.yaml');

const readYcConfigFile = () => {
    let config;

    try {
        config = yaml.parse(fs.readFileSync(YC_CONFIG_PATH, 'utf8'));
    } catch (error) {
        throw new Error(`Failed to read config ${YC_CONFIG_PATH}: ${error}`);
    }

    const { current, profiles } = config;

    if (!current) {
        throw new Error(`Invalid config in ${YC_CONFIG_PATH}: no current profile selected`);
    }

    if (!profiles[current]) {
        throw new Error(`Invalid config in ${YC_CONFIG_PATH}: no profile named ${current} exists`);
    }

    return profiles[current];
};

export const getYcConfig = (): YcConfig => {
    const oauthTokenFromEnv = getEnv(YC_OAUTH_TOKEN_ENV);
    const iamTokenFromEnv = getEnv(YC_IAM_TOKEN_ENV);
    const cloudIdFromEnv = getEnv(YC_CLOUD_ID);
    const folderIdFromEnv = getEnv(YC_FOLDER_ID);
    const isTokenDefined = Boolean(iamTokenFromEnv || oauthTokenFromEnv);

    if (isTokenDefined && cloudIdFromEnv && folderIdFromEnv) {
        log.info('Found YC configuration in environment variables, using it');

        if (iamTokenFromEnv) {
            return {
                iamToken: iamTokenFromEnv,
                cloudId: cloudIdFromEnv,
                folderId: folderIdFromEnv,
            };
        }

        if (oauthTokenFromEnv) {
            return {
                token: oauthTokenFromEnv,
                cloudId: cloudIdFromEnv,
                folderId: folderIdFromEnv,
            };
        }
    }

    log.info(`YC configuration in environment variables not found, reading yc config file: ${YC_CONFIG_PATH}`);

    const config = readYcConfigFile();
    const { token, 'cloud-id': cloudId, 'folder-id': folderId } = config;

    if (!token) {
        throw new Error(`Token is not defined in ${YC_CONFIG_PATH}`);
    }

    if (!cloudId) {
        throw new Error(`Cloud ID is not defined in ${YC_CONFIG_PATH}`);
    }

    if (!folderId) {
        throw new Error(`Folder ID is not defined in ${YC_CONFIG_PATH}`);
    }

    return {
        token,
        cloudId,
        folderId,
    };
};
