'use strict';

const jose = require('node-jose');
const fs = require('fs');
const fetch = require('node-fetch');

const URL = "https://iam.api.cloud.yandex.net/iam/v1/tokens";

module.exports = class JWT {
	constructor(auth) {
		this.iss = auth.iss;
		this.kid = auth.kid;
		this.keyfile = auth.keyfile;
	}
	
	async getIamToken() {
		return new Promise(resolve => {
			const key = fs.readFileSync(this.keyfile);
			const now = Math.floor(new Date().getTime() / 1000);
			const payload = { aud: URL,
					iss: this.iss,
					iat: now,
					exp: now + 3600 };
			jose.JWK.asKey(key, 'pem', { kid: this.kid, alg: 'PS256' })
				.then(function(result) {
					jose.JWS.createSign({ format: 'compact' }, result)
						.update(JSON.stringify(payload))
						.final()
						.then(function(result) {
							fetch(URL, {
								method: 'post',
								body: JSON.stringify({jwt: result}),
								headers: { 'Content-Type': 'application/json' }
							})
								.then(res => res.json())
								.then(json => resolve(json.iamToken));
						});
				});
		});
	}
};
