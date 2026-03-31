const BaseModel = require('../BaseModel');

class Deal extends BaseModel {
  constructor() {
    super('deals');
  }

  async getDealDetails(id) {
    return await this.db(this.tableName)
      .select(
        'deals.*',
        'clients.name as client_name',
        'sales_rep.name as sales_rep_name',
        'sales_rep.email as sales_rep_email'
      )
      .leftJoin('clients', 'deals.client_id', 'clients.id')
      .leftJoin('users as sales_rep', 'deals.sales_rep_id', 'sales_rep.id')
      .where('deals.id', id)
      .first();
  }

  async getDealsBySalesRep(salesRepId) {
    return await this.db(this.tableName)
      .select(
        'deals.*',
        'clients.name as client_name'
      )
      .leftJoin('clients', 'deals.client_id', 'clients.id')
      .where('deals.sales_rep_id', salesRepId)
      .orderBy('deals.close_date', 'desc');
  }

  async getClosedDeals() {
    return await this.db(this.tableName)
      .select(
        'deals.*',
        'clients.name as client_name',
        'sales_rep.name as sales_rep_name'
      )
      .leftJoin('clients', 'deals.client_id', 'clients.id')
      .leftJoin('users as sales_rep', 'deals.sales_rep_id', 'sales_rep.id')
      .where('deals.status', 'closed_won')
      .where('deals.handoff_status', 'pending')
      .orderBy('deals.close_date');
  }

  async updateHandoffStatus(id, status, notes = null) {
    const updateData = {
      handoff_status: status,
      updated_at: new Date()
    };
    
    if (notes) {
      updateData.handoff_notes = notes;
    }
    
    return await this.db(this.tableName).where('id', id).update(updateData);
  }

  async completeHandoff(id) {
    return await this.db(this.tableName).where('id', id).update({
      handoff_status: 'completed',
      updated_at: new Date()
    });
  }
}

module.exports = new Deal();
