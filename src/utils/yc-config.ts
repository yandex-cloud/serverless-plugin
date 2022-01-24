import path from 'path';
import yaml from 'yaml';
import fs from 'fs';
import { getEnv, getEnvStrict } from './get-env';
import { logger } from './logger';

interface YcConfig {
    token: string;
    cloudId: string;
    folderId: string;
}

const YC_TOKEN_ENV = 'YC_TOKEN';
const YC_CLOUD_ID = 'YC_CLOUD_ID';
const YC_FOLDER_ID = 'YC_FOLDER_ID';
const YC_CONFIG_PATH = path.join(getEnvStrict('HOME'), '.config/yandex-cloud/config.yaml');

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
    const tokenFromEnv = getEnv(YC_TOKEN_ENV);
    const cloudIdFromEnv = getEnv(YC_CLOUD_ID);
    const folderIdFromEnv = getEnv(YC_FOLDER_ID);

    if (tokenFromEnv && cloudIdFromEnv && folderIdFromEnv) {
        logger.info('Found YC configuration in environment variables, using it');

        return {
            token: tokenFromEnv,
            cloudId: cloudIdFromEnv,
            folderId: folderIdFromEnv,
        };
    }

    logger.info(`YC configuration in environment variables not found, reading yc config file: ${YC_CONFIG_PATH}`);

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
