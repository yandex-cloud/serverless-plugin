import { OpenAPIV3 } from 'openapi-types';
import { YCFunction } from './function';
import _ from 'lodash';
import { HttpMethods, YcOpenAPI3, YcPathsObject } from '../types/common';

export class OpenApiSpec implements YcOpenAPI3 {
    openapi = '3.0.0';
    info: OpenAPIV3.InfoObject;
    paths: YcPathsObject;
    components?: OpenAPIV3.ComponentsObject;
    security?: OpenAPIV3.SecurityRequirementObject[];

    constructor(title: string, functions: YCFunction[]) {
        this.info = {
            title,
            version: '1.0.0',
        };
        this.paths = OpenApiSpec.addPaths(functions);
    }

    toString() {
        return JSON.stringify(this);
    }

    toJson() {
        return Object.fromEntries(Object.entries(this).filter(field => field[1] !== undefined));
    }

    private static addPaths(functions: YCFunction[]) {
        const paths: {[path: string]: YcPathsObject} = {};
        const results = _.flatMap(functions, f => f.toPathTuples());
        for (const [path, pathObj] of results) {
            const currentPathObj = paths[path] ?? {};
            const merged = _.merge(pathObj, currentPathObj);
            if (merged.hasOwnProperty(HttpMethods.X_YC_API_GATEWAY_ANY_METHOD) && Object.keys(merged).length > 1) {
                throw new Error('\'x-yc-apigateway-any-method\' declared in the same path with other method');
            }
            paths[path] = merged;
        }
        return paths;
    }
}
