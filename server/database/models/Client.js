const BaseModel = require('../BaseModel');

class Client extends BaseModel {
  constructor() {
    super('clients');
  }

  async getClientDetails(id) {
    return await this.db(this.tableName)
      .select(
        'clients.*',
        'users.name as csm_name',
        'users.email as csm_email'
      )
      .leftJoin('users', 'clients.csm_id', 'users.id')
      .where('clients.id', id)
      .first();
  }

  async getClientsByCSM(csmId) {
    return await this.db(this.tableName)
      .select('*')
      .where('csm_id', csmId)
      .orderBy('name');
  }

  async getActiveClients() {
    return await this.db(this.tableName)
      .select('*')
      .where('status', 'active')
      .orderBy('health_score', 'desc');
  }

  async getAtRiskClients() {
    return await this.db(this.tableName)
      .select('*')
      .where('status', 'at_risk')
      .orderBy('health_score', 'asc');
  }

  async updateHealthScore(clientId, healthScore) {
    return await this.db(this.tableName)
      .where('id', clientId)
      .update({
        health_score: healthScore,
        updated_at: new Date()
      });
  }

  async updateStatus(clientId, status) {
    return await this.db(this.tableName)
      .where('id', clientId)
      .update({
        status: status,
        updated_at: new Date()
      });
  }
}

module.exports = new Client();
