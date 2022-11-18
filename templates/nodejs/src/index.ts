import { Handler } from '@yandex-cloud/function-types';

export const hello: Handler.Http = async (event, context) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/plain',
        },
        body: 'Hello world!'
    }
}