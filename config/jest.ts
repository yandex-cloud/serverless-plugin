import * as path from 'path';

/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
    moduleFileExtensions: [
        'js',
        'ts',
        'json',
    ],
    preset: 'ts-jest',
    rootDir: path.resolve('./src/'),
    transform: {
        '^.+\\.ts$': ['@swc/jest', {
            jsc: {
                parser: {
                    syntax: 'typescript',
                    tsx: true,
                },
            },
        }],
    },
    testEnvironment: 'node',

};
