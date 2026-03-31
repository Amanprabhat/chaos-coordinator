const BaseModel = require('../BaseModel');

class Task extends BaseModel {
  constructor() {
    super('tasks');
  }

  async getTaskDetails(id) {
    return await this.db(this.tableName)
      .select(
        'tasks.*',
        'projects.name as project_name',
        'projects.client_id',
        'clients.name as client_name',
        'assignee.name as assignee_name',
        'creator.name as creator_name'
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('clients', 'projects.client_id', 'clients.id')
      .leftJoin('users as assignee', 'tasks.assignee_id', 'assignee.id')
      .leftJoin('users as creator', 'tasks.creator_id', 'creator.id')
      .where('tasks.id', id)
      .first();
  }

  async getTasksByProject(projectId) {
    return await this.db(this.tableName)
      .select(
        'tasks.*',
        'assignee.name as assignee_name',
        'creator.name as creator_name'
      )
      .leftJoin('users as assignee', 'tasks.assignee_id', 'assignee.id')
      .leftJoin('users as creator', 'tasks.creator_id', 'creator.id')
      .where('tasks.project_id', projectId)
      .orderBy('tasks.due_date');
  }

  async getTasksByAssignee(assigneeId) {
    return await this.db(this.tableName)
      .select(
        'tasks.*',
        'projects.name as project_name',
        'clients.name as client_name'
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('clients', 'projects.client_id', 'clients.id')
      .where('tasks.assignee_id', assigneeId)
      .where('tasks.status', '!=', 'completed')
      .orderBy('tasks.due_date');
  }

  async getOverdueTasks() {
    return await this.db(this.tableName)
      .select(
        'tasks.*',
        'projects.name as project_name',
        'clients.name as client_name',
        'assignee.name as assignee_name',
        'assignee.email as assignee_email'
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('clients', 'projects.client_id', 'clients.id')
      .leftJoin('users as assignee', 'tasks.assignee_id', 'assignee.id')
      .where('tasks.due_date', '<', this.db.raw('CURRENT_DATE'))
      .where('tasks.status', '!=', 'completed')
      .orderBy('tasks.due_date');
  }

  async getBlockedTasks() {
    return await this.db(this.tableName)
      .select(
        'tasks.*',
        'projects.name as project_name',
        'clients.name as client_name',
        'assignee.name as assignee_name'
      )
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .leftJoin('clients', 'projects.client_id', 'clients.id')
      .leftJoin('users as assignee', 'tasks.assignee_id', 'assignee.id')
      .where('tasks.status', 'blocked')
      .orderBy('tasks.due_date');
  }

  async completeTask(id) {
    return await this.db(this.tableName).where('id', id).update({
      status: 'completed',
      completed_at: new Date(),
      updated_at: new Date()
    });
  }

  async updateStatus(id, status) {
    return await this.db(this.tableName).where('id', id).update({
      status,
      updated_at: new Date()
    });
  }
}

module.exports = new Task();
