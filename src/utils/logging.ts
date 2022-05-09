const {
    progress,
    log,
    writeText,
}: {progress: Progress, log: Log, writeText: (text: string | string[]) => void} = require('@serverless/utils/log');

export interface ProgressReporter {
    update: (message: string) => void;
    remove: () => void;
}

export interface Progress {
    create: (options: {
        message?: string,
        name?: string,
    }) => ProgressReporter;
}

export interface Log {
    error: (text: string) => void;
    warning: (text: string) => void;
    notice: {
        skip: (text: string) => void;
        success: (text: string) => void;
        (text: string): void;
    };
    info: (text: string) => void;
    debug: (text: string) => void;
    verbose: (text: string) => void;
    success: (text: string) => void;
}

export {
    progress,
    log,
    writeText,
};
