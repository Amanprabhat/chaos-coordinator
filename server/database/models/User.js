const BaseModel = require('../BaseModel');

class User extends BaseModel {
  constructor() {
    super('users');
  }

  async findByEmail(email) {
    return await this.db(this.tableName).where('email', email).first();
  }

  async findByRole(role) {
    return await this.db(this.tableName).where('role', role).where('is_active', true);
  }

  async getActiveUsers() {
    return await this.db(this.tableName).where('is_active', true);
  }

  async updateLastLogin(id) {
    return await this.db(this.tableName).where('id', id).update({
      updated_at: new Date()
    });
  }

  async getTeamMembers(department) {
    return await this.db(this.tableName)
      .where('department', department)
      .where('is_active', true)
      .orderBy('name');
  }
}

module.exports = new User();
