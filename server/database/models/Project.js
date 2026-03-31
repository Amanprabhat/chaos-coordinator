const BaseModel = require('../BaseModel');

class Project extends BaseModel {
  constructor() {
    super('projects');
  }

  async getProjectDetails(id) {
    return await this.db(this.tableName)
      .select(
        'projects.*',
        'clients.name as client_name',
        'users.name as pm_name',
        'users.email as pm_email',
        'deals.value as deal_value',
        'deals.close_date as deal_close_date'
      )
      .leftJoin('clients', 'projects.client_id', 'clients.id')
      .leftJoin('users', 'projects.pm_id', 'users.id')
      .leftJoin('deals', 'projects.deal_id', 'deals.id')
      .where('projects.id', id)
      .first();
  }

  async getProjectsByPM(pmId) {
    return await this.db(this.tableName)
      .select(
        'projects.*',
        'clients.name as client_name'
      )
      .leftJoin('clients', 'projects.client_id', 'clients.id')
      .where('projects.pm_id', pmId)
      .orderBy('projects.created_at', 'desc');
  }

  async getProjectsByStage(stage) {
    return await this.db(this.tableName)
      .select(
        'projects.*',
        'clients.name as client_name',
        'users.name as pm_name'
      )
      .leftJoin('clients', 'projects.client_id', 'clients.id')
      .leftJoin('users', 'projects.pm_id', 'users.id')
      .where('projects.stage', stage)
      .orderBy('projects.target_date');
  }

  async getDelayedProjects() {
    return await this.db(this.tableName)
      .select(
        'projects.*',
        'clients.name as client_name',
        'users.name as pm_name'
      )
      .leftJoin('clients', 'projects.client_id', 'clients.id')
      .leftJoin('users', 'projects.pm_id', 'users.id')
      .where('projects.target_date', '<', this.db.raw('CURRENT_DATE'))
      .where('projects.status', '!=', 'completed')
      .orderBy('projects.target_date');
  }

  async updateStage(id, stage) {
    return await this.db(this.tableName).where('id', id).update({
      stage,
      updated_at: new Date()
    });
  }
}

module.exports = new Project();
