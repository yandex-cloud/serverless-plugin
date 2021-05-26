

module.exports = class DeployResources {
	
	constructor(serverless, options){
		this.serverless = serverless;
        this.options = options;
        this.provider = this.serverless.getProvider('yandex-cloud');
	}
	
	compare
	
	async deployAccount(name, account) {
		this.serverless.cli.log(`Deploing account ${name}`);
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
		if (foundAccount){
			// check roles
			const sameRoles = (account.roles.length == foundAccount.roles.length && 
				account.roles.every(r => foundAccount.roles.indexOf(r)>=0));
			if (!sameRoles) {
				this.serverless.cli.log(`Changing roles for account ${name}`);
				await this.provider.updateAccessBindings(account.id, account.roles);
			}
		}else{
			const req = {name, roles: account.roles};
			foundAccount = await this.provider.createServiceAccount(req);
			this.serverless.cli.log(`Create account ${name} id=${foundAccount.id}`);
		}
		account.id = foundAccount.id;
	}

	async deployDatabase(name, db) {
		this.serverless.cli.log(`Deploing database ${name}`);
	}
	
	async deployLockbox(name, lockbox) {
		this.serverless.cli.log(`Deploing lockbox ${name}`);
	}
	
	async deployApiGateway(name, gateway) {
		this.serverless.cli.log(`Deploing api-gateway ${name}`);
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
		this.serverless.cli.log('Deploing resources');
		await this.deployEntries('accounts', this.deployAccount);
		await this.deployEntries('databases', this.deployDatabase);
		await this.deployEntries('lockboxes', this.deployLockbox);
		await this.deployEntries('apigateways', this.deployApiGateway);
		await this.deployEntries('notfound', this.deployApiGateway);
		
		throw "The end";
	}
};