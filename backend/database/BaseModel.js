const db = require('./connection');

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
    this.db = db;
  }

  async findById(id) {
    return await this.db(this.tableName).where('id', id).first();
  }

  async findAll(filters = {}) {
    let query = this.db(this.tableName);
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined) {
        query = query.where(key, filters[key]);
      }
    });
    
    return await query;
  }

  async create(data) {
    const [result] = await this.db(this.tableName).insert(data).returning('*');
    return result;
  }

  async update(id, data) {
    const [result] = await this.db(this.tableName).where('id', id).update(data).returning('*');
    return result;
  }

  async delete(id) {
    return await this.db(this.tableName).where('id', id).del();
  }

  async count(filters = {}) {
    let query = this.db(this.tableName);
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined) {
        query = query.where(key, filters[key]);
      }
    });
    
    return await query.first().count('* as count');
  }
}

module.exports = BaseModel;
