// @ts-ignore
import * as util from '@serverless/utils/log';

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

const progress = util.progress as Progress;
const log = util.log as Log;
const writeText = util.writeText as (text: string | string[]) => void;

export {
    progress,
    log,
    writeText,
};
