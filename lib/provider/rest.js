'use strict';

const fetch = require('node-fetch');
const yaml = require('yaml');

const ENDPOINTS = {
	"lockbox": "https://lockbox.api.cloud.yandex.net",
	"ydb": "https://ydb.api.cloud.yandex.net",
	"apigw": "https://serverless-apigateway.api.cloud.yandex.net"
};

const OPENAPI_EMPTY_YAML = `
openapi: 3.0.0
info:
  title: title
  version: 1.0.0
  
paths:
  /:
    get:
      x-yc-apigateway-integration:
        type: dummy
        content:
          '*': Page not found.
        http_code: 404
        http_headers:
          Content-Type: text/plain
`;

module.exports = class REST {
	
	constructor(config) {
		this.token = config.token;
		this.cloudId = config['cloud-id'];
		this.folderId = config['folder-id'];
	}
	
	async restCall(endpoint, request, postdata=null, method=null) {
		if (!method) {
			method = postdata ? "post" : "get";
		}
		const headers = {
			'Authorization': `Bearer ${this.token}`,
			'Content-Type': 'aplication/json'
			};
		const url = `${ENDPOINTS[endpoint]}/${request}`;
		return new Promise((resolve, reject) => {
			let status = 0;
			fetch(url, {
				method,
				headers,
				body: postdata ? JSON.stringify(postdata) : null
			})
			.then(res => {
				status = res.status;
				return res.json();
				})
			.then(json => {
				if (status != 200) {
					reject(`Error ${status}(${json.code}): ${json.message}`);
				}
				resolve(json);
				});
		});
	}
	
	async lockboxList() {
		return await this.restCall("lockbox", `lockbox/v1/secrets?folderId=${this.folderId}`);
	}
	
	async lockboxCreate(req) {
		const entries = req.keys.map(key => {
			return {key, textValue:"undefined"};
		});
		const post = {
			folderId: this.folderId,
			name: req.name,
			versionPayloadEntries: entries
		};
		return await this.restCall("lockbox", "lockbox/v1/secrets", post);
	}

	async lockboxAddKeys(secretId, keys) {
		const entries = keys.map(key => {
			return {key, textValue:"undefined"};
		});
		return await this.restCall("lockbox", `lockbox/v1/secrets/${secretId}:addVersion`, {payloadEntries: entries});
	}
	
	async ydbList() {
		return await this.restCall("ydb", `ydb/v1/databases?folderId=${this.folderId}`);
	}

	async ydbCreate(name) {
		const post = {
			folderId: this.folderId,
			name,
			serverlessDatabase: {
			}
		};
		return await this.restCall("ydb", `ydb/v1/databases`, post);
	}
	
	async apigwList() {
		return await this.restCall("apigw", `apigateways/v1/apigateways?folderId=${this.folderId}`);
	}

	async apigwCreate(name) {
		const post = {
			folderId: this.folderId,
			name,
			openapiSpec: OPENAPI_EMPTY_YAML
		};
		return await this.restCall("apigw", `apigateways/v1/apigateways`, post);
	}
	
	async apigwUpdate(apigwId, specObject) {
		const patch = {
			openapiSpec: yaml.stringify(specObject)
		};
		return await this.restCall("apigw", `apigateways/v1/apigateways/${apigwId}`, patch, "patch");
	}

};