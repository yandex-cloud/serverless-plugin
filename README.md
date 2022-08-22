[![npm](https://img.shields.io/npm/v/@yandex-cloud/serverless-plugin)](https://www.npmjs.com/package/@yandex-cloud/serverless-plugin)
[![License](https://img.shields.io/github/license/yandex-cloud/serverless-plugin.svg)](https://github.com/yandex-cloud/serverless-plugin/blob/master/LICENSE)


# Serverless Yandex Cloud Functions Plugin

This plugin enables support for Yandex Cloud Functions within the [Serverless Framework](https://github.com/serverless/serverless).

## Quick Start

First you need to install the `serverless` command-line tool. Check the official [getting started](https://www.serverless.com/framework/docs/getting-started/) guide. Fastest way to do this is to use `npm`:

    npm install serverless -g

Now you can create new project from template provided by this plugin:

    serverless create \
      --template-url https://github.com/yandex-cloud/serverless-plugin/tree/master/templates/nodejs

Before you deploy your first functions using Serverless, you need to configure Yandex.Cloud credentials. There are two ways to do it:
- Install the `yc` command-line tool and use the setup wizard to provide all required parameters. All required guides and in-depth documentation is available at [Yandex.Cloud website](https://cloud.yandex.com/docs/cli/quickstart).
- Provide `YC_OAUTH_TOKEN` (or `YC_IAM_TOKEN`), `YC_CLOUD_ID` and `YC_FOLDER_ID` environment variables
- If you are going to create/edit YMQ or S3 buckets, you need to provide `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` environment variables. [How to create static access keys](https://cloud.yandex.com/en-ru/docs/iam/operations/sa/create-access-key)

To deploy your project use:

    serverless deploy

To invoke (test) your function:

    serverless invoke -f simple

To remove all deployed resources:

    serverless remove

## Configuration variables from Lockbox

This plugin adds [configuration variable source](https://www.serverless.com/framework/docs/providers/aws/guide/variables), which allows to retrieve secrets from [Lockbox](https://cloud.yandex.com/en/docs/lockbox/).
Usage example:
```yaml
functions:
  simple:
    handler: dist/index.hello
    memorySize: 128
    timeout: '5'
    account: function-sa
    environment:
      DB_PASSWORD: ${lockbox:<lockbox_secret_id>/<lockbox_secret_key>}
```

## Supported resources
- Cloud Functions
- Triggers
- Service Accounts
- Container Registries
- Message Queues
- S3 Buckets
