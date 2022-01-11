import path from 'path';
import yaml from 'yaml';
import fs from 'fs';

import { getEnv } from '../utils/get-env';

export const readCliConfig = () => {
    const configFile = path.join(getEnv('HOME'), '.config/yandex-cloud/config.yaml');

    let config;

    try {
        config = yaml.parse(fs.readFileSync(configFile, 'utf8'));
    } catch (error) {
        throw new Error(`Failed to read config ${configFile}: ${error}`);
    }

    const { current, profiles } = config;

    if (!current) {
        throw new Error(`Invalid config in ${configFile}: no current profile selected`);
    }

    if (!profiles[current]) {
        throw new Error(`Invalid config in ${configFile}: no profile named ${current} exists`);
    }

    return profiles[current];
};

export const fileToBase64 = (filePath: string) => fs.readFileSync(filePath, 'base64');
