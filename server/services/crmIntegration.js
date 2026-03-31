const axios = require('axios');
const Deal = require('../database/models/Deal');
const Client = require('../database/models/Client');
const User = require('../database/models/User');

class CRMIntegration {
  static async syncSalesforceDeals() {
    try {
      if (!process.env.SALESFORCE_CLIENT_ID || !process.env.SALESFORCE_CLIENT_SECRET) {
        console.log('Salesforce integration not configured');
        return;
      }

      const accessToken = await this.getSalesforceAccessToken();
      const deals = await this.fetchSalesforceDeals(accessToken);
      
      await this.processSalesforceDeals(deals);
      
      console.log(`Synced ${deals.length} deals from Salesforce`);
    } catch (error) {
      console.error('Salesforce sync error:', error);
    }
  }

  static async getSalesforceAccessToken() {
    try {
      const response = await axios.post('https://login.salesforce.com/services/oauth2/token', {
        grant_type: 'password',
        client_id: process.env.SALESFORCE_CLIENT_ID,
        client_secret: process.env.SALESFORCE_CLIENT_SECRET,
        username: process.env.SALESFORCE_USERNAME,
        password: process.env.SALESFORCE_PASSWORD
      });

      return response.data.access_token;
    } catch (error) {
      console.error('Salesforce auth error:', error);
      throw error;
    }
  }

  static async fetchSalesforceDeals(accessToken) {
    try {
      const soqlQuery = `
        SELECT Id, Name, AccountId, Account.Name, Amount, CloseDate, StageName, 
               OwnerId, Owner.Name, Owner.Email, Description, LastModifiedDate
        FROM Opportunity 
        WHERE StageName = 'Closed Won' 
        AND LastModifiedDate = LAST_N_DAYS:30
        ORDER BY CloseDate DESC
      `;

      const response = await axios.get(
        `https://yourinstance.salesforce.com/services/data/v56.0/query?q=${encodeURIComponent(soqlQuery)}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.records;
    } catch (error) {
      console.error('Salesforce query error:', error);
      throw error;
    }
  }

  static async processSalesforceDeals(deals) {
    for (const sfDeal of deals) {
      try {
        let client = await this.findOrCreateClient(sfDeal);
        let salesRep = await this.findOrCreateSalesRep(sfDeal);
        
        const existingDeal = await Deal.findAll({
          name: sfDeal.Name,
          client_id: client.id
        });

        if (existingDeal.length === 0) {
          await Deal.create({
            name: sfDeal.Name,
            client_id: client.id,
            sales_rep_id: salesRep.id,
            value: sfDeal.Amount,
            close_date: sfDeal.CloseDate,
            status: 'closed_won',
            handoff_status: 'pending',
            description: sfDeal.Description
          });
        }
      } catch (error) {
        console.error(`Error processing deal ${sfDeal.Id}:`, error);
      }
    }
  }

  static async findOrCreateClient(sfDeal) {
    const Client = require('../database/models/Client');
    
    let client = await Client.findAll({ name: sfDeal.Account.Name });
    
    if (client.length === 0) {
      client = await Client.create({
        name: sfDeal.Account.Name,
        status: 'active',
        health_score: 80
      });
    } else {
      client = client[0];
    }
    
    return client;
  }

  static async findOrCreateSalesRep(sfDeal) {
    let salesRep = await User.findByEmail(sfDeal.Owner.Email);
    
    if (!salesRep) {
      salesRep = await User.create({
        name: sfDeal.Owner.Name,
        email: sfDeal.Owner.Email,
        password_hash: 'temp_hash',
        role: 'sales',
        department: 'Sales'
      });
    }
    
    return salesRep;
  }

  static async syncHubSpotDeals() {
    try {
      if (!process.env.HUBSPOT_ACCESS_TOKEN) {
        console.log('HubSpot integration not configured');
        return;
      }

      const deals = await this.fetchHubSpotDeals();
      await this.processHubSpotDeals(deals);
      
      console.log(`Synced ${deals.length} deals from HubSpot`);
    } catch (error) {
      console.error('HubSpot sync error:', error);
    }
  }

  static async fetchHubSpotDeals() {
    try {
      const response = await axios.get(
        'https://api.hubapi.com/crm/v3/objects/deals',
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          params: {
            limit: 100,
            properties: ['dealname', 'amount', 'closedate', 'dealstage', 'hubspot_owner_id', 'description']
          }
        }
      );

      return response.data.results;
    } catch (error) {
      console.error('HubSpot fetch error:', error);
      throw error;
    }
  }

  static async processHubSpotDeals(deals) {
    for (const hsDeal of deals) {
      try {
        if (hsDeal.properties.dealstage !== 'closedwon') {
          continue;
        }

        const dealData = {
          name: hsDeal.properties.dealname,
          value: hsDeal.properties.amount,
          close_date: hsDeal.properties.closedate ? new Date(parseInt(hsDeal.properties.closedate)).toISOString().split('T')[0] : null,
          description: hsDeal.properties.description,
          status: 'closed_won',
          handoff_status: 'pending'
        };

        await this.createOrUpdateHubSpotDeal(hsDeal.id, dealData);
      } catch (error) {
        console.error(`Error processing HubSpot deal ${hsDeal.id}:`, error);
      }
    }
  }

  static async createOrUpdateHubSpotDeal(hubspotId, dealData) {
    const existingDeal = await Deal.findAll({ hubspot_id: hubspotId });
    
    if (existingDeal.length === 0) {
      await Deal.create({
        ...dealData,
        hubspot_id: hubspotId
      });
    }
  }

  static async exportProjectStatus(project) {
    try {
      if (process.env.SALESFORCE_ACCESS_TOKEN) {
        await this.exportToSalesforce(project);
      }
      
      if (process.env.HUBSPOT_ACCESS_TOKEN) {
        await this.exportToHubSpot(project);
      }
    } catch (error) {
      console.error('Project export error:', error);
    }
  }

  static async exportToSalesforce(project) {
    try {
      const accessToken = await this.getSalesforceAccessToken();
      
      const projectData = {
        Name: project.name,
        Client__c: project.client_id,
        Project_Manager__c: project.pm_id,
        Status__c: project.status,
        Stage__c: project.stage,
        Budget__c: project.budget,
        Target_Date__c: project.target_date
      };

      await axios.post(
        'https://yourinstance.salesforce.com/services/data/v56.0/sobjects/Project__c/',
        projectData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Salesforce export error:', error);
    }
  }

  static async exportToHubSpot(project) {
    try {
      const projectData = {
        properties: {
          project_name: project.name,
          client_id: project.client_id.toString(),
          project_manager_id: project.pm_id.toString(),
          status: project.status,
          stage: project.stage,
          budget: project.budget?.toString(),
          target_date: project.target_date
        }
      };

      await axios.post(
        'https://api.hubapi.com/crm/v3/objects/projects',
        projectData,
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('HubSpot export error:', error);
    }
  }

  static async scheduleSync() {
    const cron = require('node-cron');
    
    cron.schedule('0 */6 * * *', async () => {
      console.log('Running CRM sync...');
      await this.syncSalesforceDeals();
      await this.syncHubSpotDeals();
    });
  }
}

module.exports = CRMIntegration;
