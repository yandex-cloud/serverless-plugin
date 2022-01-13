import { FunctionContext, FunctionEvent } from './types';

export const hello = async (event: FunctionEvent, context: FunctionContext) => ({
    statusCode: 200,
    headers: {
        'Content-Type': 'text/plain',
    },
    body: 'Hello world!',
});
