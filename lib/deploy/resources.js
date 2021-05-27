'use strict';

module.exports = class DeployResources {
	
	constructor(serverless, options){
		this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('yandex-cloud');
	}
	
	async deployAccount(name, account) {
		this.serverless.cli.log(`Deploing account ${name} ...`);
		if ('name' in account) {
			name = account.name;
		}
		const accs = await this.provider.getServiceAccounts();
		let foundAccount = null;
		for (const acc of accs) {
			if (acc.name == name){
				foundAccount = acc;
				break;
			}
		}
		if (foundAccount) {
			// check roles
			const sameRoles = (account.roles.length == foundAccount.roles.length && 
				account.roles.every(r => foundAccount.roles.indexOf(r)>=0));
			if (!sameRoles) {
				this.serverless.cli.log(`Change roles for account ${name}`);
				await this.provider.updateAccessBindings(account.id, account.roles);
			}
		}else{
			// create Account
			const req = {name, roles: account.roles};
			foundAccount = await this.provider.createServiceAccount(req);
			this.serverless.cli.log(`Create account ${name} id=${foundAccount.id}`);
		}
		account.id = foundAccount.id;
	}

	async deployDatabase(name, database) {
		this.serverless.cli.log(`Deploing database ${name} ...`);		
		if ('name' in database) {
			name = database.name;
		}
		const dbs = await this.provider.getRest().ydbList();
		if ('databases' in dbs && dbs.databases){
			for (const db of dbs.databases) {
				if (db.name == name){
					database.id = db.id;
					database.endpoint = db.endpoint;
					return;
				}
			}
		}
		this.serverless.cli.log(`Create database ${name}`);
		const db = await this.provider.getRest().ydbCreate(name);
		database.id = db.id;
		database.endpoint = db.endpoint;
	}
	
	async deployLockbox(name, lockbox) {
		this.serverless.cli.log(`Deploing lockbox ${name} ...`);
		if ('name' in lockbox) {
			name = lockbox.name;
		}
		const locks = await this.provider.getRest().lockboxList();
		let currentLock = null;
		for (const lock of locks.secrets) {
			if (lock.name == name) {
				currentLock = lock;
				break;
			}
		}
		if (!currentLock){
			this.serverless.cli.log(`Create lockbox ${name} ...`);
			currentLock = await this.provider.getRest().lockboxCreate({name, keys: lockbox.keys});
		}else{
			// check payloadEntryKeys
			const keysToAdd = [];
			for (const key of lockbox.keys) {
				if (currentLock.currentVersion.payloadEntryKeys.indexOf(key) < 0){
					keysToAdd.push(key);
				}
			}
			if (keysToAdd.length > 0) {
				this.serverless.cli.log(`Lockbox ${name} add keys ${JSON.stringify(keysToAdd)}`);
				await this.provider.getRest().lockboxAddKeys(currentLock.id, keysToAdd);
			}
		}
		lockbox.id = currentLock.id;
	}
	
	async deployApiGateway(name, gateway) {
		this.serverless.cli.log(`Deploing api-gateway ${name} ...`);
		if ('name' in gateway) {
			name = gateway.name;
		}
		const gws = await this.provider.getRest().apigwList();
		for(const gw of gws.apiGateways) {
			if (gw.name == name) {
				gateway.id = gw.id;
				gateway.domain = gw.domain;
				return;
			}
		}
		this.serverless.cli.log(`Create API-gateway ${name}`);
		const gw = await this.provider.getRest().apigwCreate(name);
		gateway.id = gw.id;
		gateway.domain = gw.domain;
	}


	async deployEntries(typename, proc){
		const resources = this.serverless.service.resources;
		if (!(typename in resources)) {
			return;
		}
		const bind = proc.bind(this);
		for (const [name, obj] of Object.entries(resources[typename])) {
			await bind(name, obj);
		}
	}
	
	async deploy(){
		await this.deployEntries('accounts', this.deployAccount);
		await this.deployEntries('databases', this.deployDatabase);
		await this.deployEntries('lockboxes', this.deployLockbox);
		await this.deployEntries('apigateways', this.deployApiGateway);
	}
};