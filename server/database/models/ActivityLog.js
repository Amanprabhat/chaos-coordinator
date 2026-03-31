const BaseModel = require('../BaseModel');

class ActivityLog extends BaseModel {
  constructor() {
    super('activity_logs');
  }

  async getEntityHistory(entityType, entityId) {
    return await this.db(this.tableName)
      .select(
        'activity_logs.*',
        'users.name as user_name',
        'users.email as user_email',
        'users.role as user_role'
      )
      .leftJoin('users', 'activity_logs.user_id', 'users.id')
      .where('activity_logs.entity_type', entityType)
      .where('activity_logs.entity_id', entityId)
      .orderBy('activity_logs.created_at', 'desc');
  }

  async getUserActivity(userId, limit = 50) {
    return await this.db(this.tableName)
      .select(
        'activity_logs.*',
        'users.name as user_name'
      )
      .leftJoin('users', 'activity_logs.user_id', 'users.id')
      .where('activity_logs.user_id', userId)
      .orderBy('activity_logs.created_at', 'desc')
      .limit(limit);
  }

  async getRecentActivity(limit = 20) {
    return await this.db(this.tableName)
      .select(
        'activity_logs.*',
        'users.name as user_name',
        'users.role as user_role'
      )
      .leftJoin('users', 'activity_logs.user_id', 'users.id')
      .orderBy('activity_logs.created_at', 'desc')
      .limit(limit);
  }
}

module.exports = new ActivityLog();
