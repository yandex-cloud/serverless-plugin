'use strict';

const fs = require('fs');

const YC_INT = "x-yc-apigateway-integration";

module.exports = class ApiGW {
	
	constructor(serverless, deploy) {
		this.serverless = serverless;
		this.deploy = deploy;
		this.newState = null;
	}
	
	setNewState(newState) {
        this.newState = newState;
    }
	
	getAccountId(accName) {
		for (const [name, acc] of Object.entries(this.serverless.service.resources.accounts)) {
			if (name == accName) {
				return acc.id;
			}
		}
		throw `Account not found for openapi: ${accName}`;
	}
	
	getFunctionId(funcName) {
		for(const func of Object.values(this.deploy.functionRegistry)){
			if (func.newState.name == funcName){
				return func.id;
			}
		}
		throw `Function not found for openapi: ${funcName}`;
	}
	
	async sync() {
		const provider = this.serverless.getProvider('yandex-cloud');
		this.serverless.cli.log(`Sync api-gateway ${this.newState.name}`);
		
		const openapi = this.newState.params.openapi;
		
		openapi.servers[0].url = `https://${this.newState.params.domain}`;
		
		for(const [name, obj] of Object.entries(openapi.paths)) {
			for (const [meth, path] of Object.entries(obj)){
				if (!(YC_INT in path)) {
					continue;
				}
				const cfg = path[YC_INT];
				if ('service_account' in cfg) {
					cfg.service_account_id = this.getAccountId(cfg.service_account);
					delete cfg.service_account;
				}
				if ('function' in cfg){
					cfg.function_id = this.getFunctionId(cfg['function']);
					delete cfg['function'];
				}
			}
		}
		
		await provider.getRest().apigwUpdate(this.newState.params.id, openapi);

	}
	
};