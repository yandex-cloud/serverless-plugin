module.exports.hello = async (event, context) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/plain',
        },
        body: 'Hello world!'
    };
};
