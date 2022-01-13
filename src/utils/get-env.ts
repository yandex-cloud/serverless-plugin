export const getEnvStrict = (envName: string, defaultValue?: string): string => {
    const envValue = process.env[envName] || defaultValue;

    if (!envValue) {
        throw new Error(`Env variable ${envName} is not defined`);
    }

    return envValue;
};

export const getEnv = (envName: string): string | undefined => process.env[envName];
