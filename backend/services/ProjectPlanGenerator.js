const db = require('../database/connection');
const TemplateEngine = require('./TemplateEngine');
const SOWParsingService = require('./SOWParsingService');

class ProjectPlanGenerator {
  constructor() {
    this.templateEngine = new TemplateEngine();
    this.sowParser = new SOWParsingService();
  }

  /**
   * Generate complete project plan from intake
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Generated project plan
   */
  async generateProjectPlan(projectId) {
    try {
      console.log(`Starting project plan generation for: ${projectId}`);

      // 1. Get project details
      const project = await this.getProjectDetails(projectId);
      
      // 2. Get SOW document and AI extraction
      const sowData = await this.getSOWData(project.sow_document_id);
      
      // 3. Select appropriate template
      const template = await this.templateEngine.selectTemplate(project.project_type);
      
      // 4. Merge template with SOW extraction
      const projectPlan = await this.templateEngine.mergeWithSOW(
        template, 
        sowData.aiExtraction, 
        project
      );
      
      // 5. Generate tasks in database
      const generatedTasks = await this.createTasksInDatabase(projectPlan);
      
      // 6. Calculate project risks
      const riskAnalysis = await this.performRiskAnalysis(project, projectPlan);
      
      // 7. Update project with generated plan info
      await this.updateProjectWithPlan(projectId, projectPlan, riskAnalysis);
      
      // 8. Log activity
      await this.logGenerationActivity(projectId, projectPlan);

      return {
        project_id: projectId,
        plan_summary: {
          total_tasks: projectPlan.total_tasks,
          phases: projectPlan.phases.length,
          timeline_days: projectPlan.timeline.total_working_days,
          confidence_score: projectPlan.sow_confidence,
          risk_score: riskAnalysis.overall_score
        },
        phases: projectPlan.phases,
        tasks: generatedTasks,
        warnings: projectPlan.warnings,
        risk_summary: projectPlan.risk_summary,
        next_steps: [
          'Review generated project plan',
          'Validate task assignments and timelines',
          'Confirm project creation'
        ]
      };

    } catch (error) {
      console.error('Project plan generation error:', error);
      throw new Error(`Failed to generate project plan: ${error.message}`);
    }
  }

  /**
   * Get project details for plan generation
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Project details
   */
  async getProjectDetails(projectId) {
    const project = await db('projects')
      .select('*')
      .where('id', projectId)
      .first();

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return project;
  }

  /**
   * Get SOW document and AI extraction data
   * @param {string} sowDocumentId - SOW document ID
   * @returns {Promise<Object>} SOW data
   */
  async getSOWData(sowDocumentId) {
    // Get SOW document
    const sowDocument = await db('sow_documents')
      .select('*')
      .where('id', sowDocumentId)
      .first();

    if (!sowDocument) {
      throw new Error(`SOW document not found: ${sowDocumentId}`);
    }

    // Get AI extraction
    const aiExtraction = await db('ai_extractions')
      .select('*')
      .where('sow_document_id', sowDocumentId)
      .first();

    if (!aiExtraction) {
      throw new Error(`AI extraction not found for SOW: ${sowDocumentId}`);
    }

    return {
      document: sowDocument,
      aiExtraction: aiExtraction
    };
  }

  /**
   * Create tasks in database from project plan
   * @param {Object} projectPlan - Generated project plan
   * @returns {Promise<Array>} Created tasks
   */
  async createTasksInDatabase(projectPlan) {
    const createdTasks = [];

    for (const taskData of projectPlan.tasks) {
      const [task] = await db('tasks').insert({
        project_id: projectPlan.project_id,
        template_task_id: taskData.template_task_id,
        name: taskData.name,
        description: taskData.description,
        phase: taskData.phase,
        sequence_order: taskData.sequence_order,
        duration_days: taskData.duration_days,
        owner_role: taskData.owner_role,
        start_date: taskData.start_date,
        end_date: taskData.end_date,
        is_parallel: taskData.is_parallel,
        dependencies: taskData.dependencies,
        status: 'todo',
        risk_flag: taskData.risk_flag || 'none',
        progress_percentage: 0
      }).returning('*');

      // Create explicit dependencies if any
      if (taskData.dependencies && taskData.dependencies.length > 0) {
        await this.createTaskDependencies(task.id, taskData.dependencies, projectPlan.tasks);
      }

      createdTasks.push(task);
    }

    return createdTasks;
  }

  /**
   * Create explicit task dependencies
   * @param {string} taskId - Current task ID
   * @param {Array} dependencies - Dependency sequence orders
   * @param {Array} allTasks - All tasks for mapping
   */
  async createTaskDependencies(taskId, dependencies, allTasks) {
    for (const depSequence of dependencies) {
      const depTask = allTasks.find(t => t.sequence_order === depSequence);
      if (depTask) {
        // Find the actual database task ID for this dependency
        const depTaskRecord = await db('tasks')
          .select('id')
          .where('project_id', allTasks[0].project_id) // All tasks have same project_id
          .where('sequence_order', depSequence)
          .first();

        if (depTaskRecord) {
          await db('task_dependencies').insert({
            task_id: taskId,
            depends_on_task_id: depTaskRecord.id,
            dependency_type: 'finish_to_start'
          });
        }
      }
    }
  }

  /**
   * Perform comprehensive risk analysis
   * @param {Object} project - Project details
   * @param {Object} projectPlan - Generated project plan
   * @returns {Promise<Object>} Risk analysis results
   */
  async performRiskAnalysis(project, projectPlan) {
    const risks = [];

    // 1. Timeline risk analysis
    const timelineRisk = this.analyzeTimelineRisk(project, projectPlan);
    if (timelineRisk) risks.push(timelineRisk);

    // 2. Complexity risk analysis
    const complexityRisk = this.analyzeComplexityRisk(project, projectPlan);
    if (complexityRisk) risks.push(complexityRisk);

    // 3. Resource risk analysis
    const resourceRisk = this.analyzeResourceRisk(project, projectPlan);
    if (resourceRisk) risks.push(resourceRisk);

    // 4. Dependency risk analysis
    const dependencyRisk = this.analyzeDependencyRisk(project, projectPlan);
    if (dependencyRisk) risks.push(dependencyRisk);

    // 5. SOW confidence risk
    const confidenceRisk = this.analyzeConfidenceRisk(projectPlan);
    if (confidenceRisk) risks.push(confidenceRisk);

    // Calculate overall risk score
    const overallScore = this.calculateOverallRiskScore(risks);

    // Store risks in database
    await this.storeProjectRisks(project.id, risks);

    return {
      overall_score: overallScore,
      risk_level: this.getRiskLevel(overallScore),
      total_risks: risks.length,
      risks_by_type: this.categorizeRisks(risks),
      mitigation_recommendations: this.generateMitigationRecommendations(risks)
    };
  }

  /**
   * Analyze timeline risks
   * @param {Object} project - Project details
   * @param {Object} projectPlan - Project plan
   * @returns {Object|null} Timeline risk analysis
   */
  analyzeTimelineRisk(project, projectPlan) {
    const plannedDays = projectPlan.timeline.total_working_days;
    const availableDays = Math.ceil((new Date(project.end_date) - new Date(project.start_date)) / (1000 * 60 * 60 * 24));
    
    if (plannedDays > availableDays * 0.9) {
      return {
        type: 'timeline',
        severity: 'high',
        description: 'Project timeline is very tight with minimal buffer',
        impact: 'High risk of delays',
        mitigation: 'Consider extending timeline or reducing scope'
      };
    } else if (plannedDays > availableDays * 0.8) {
      return {
        type: 'timeline',
        severity: 'medium',
        description: 'Project timeline has limited buffer',
        impact: 'Medium risk of delays',
        mitigation: 'Monitor progress closely and be prepared to adjust'
      };
    }

    return null;
  }

  /**
   * Analyze complexity risks
   * @param {Object} project - Project details
   * @param {Object} projectPlan - Project plan
   * @returns {Object|null} Complexity risk analysis
   */
  analyzeComplexityRisk(project, projectPlan) {
    const technicalTasks = projectPlan.tasks.filter(t => t.owner_role === 'technical');
    const integrationTasks = projectPlan.tasks.filter(t => 
      t.name.toLowerCase().includes('integration') || 
      t.name.toLowerCase().includes('api')
    );

    if (integrationTasks.length > 2) {
      return {
        type: 'complexity',
        severity: 'high',
        description: 'Multiple integration points increase complexity',
        impact: 'High technical risk and potential delays',
        mitigation: 'Assign senior technical resources and plan for testing'
      };
    } else if (technicalTasks.length > projectPlan.tasks.length * 0.6) {
      return {
        type: 'complexity',
        severity: 'medium',
        description: 'High proportion of technical tasks',
        impact: 'Medium technical complexity',
        mitigation: 'Ensure technical expertise is available'
      };
    }

    return null;
  }

  /**
   * Analyze resource risks
   * @param {Object} project - Project details
   * @param {Object} projectPlan - Project plan
   * @returns {Object|null} Resource risk analysis
   */
  analyzeResourceRisk(project, projectPlan) {
    const tasksByRole = this.groupTasksByRole(projectPlan.tasks);
    
    // Check for role overload
    for (const [role, tasks] of Object.entries(tasksByRole)) {
      const totalDays = tasks.reduce((sum, task) => sum + task.duration_days, 0);
      
      if (totalDays > 60) { // More than 3 months of work for one role
        return {
          type: 'resource',
          severity: 'medium',
          description: `${role} role has high workload (${totalDays} days)`,
          impact: 'Resource burnout risk',
          mitigation: 'Consider additional resources or task redistribution'
        };
      }
    }

    return null;
  }

  /**
   * Analyze dependency risks
   * @param {Object} project - Project details
   * @param {Object} projectPlan - Project plan
   * @returns {Object|null} Dependency risk analysis
   */
  analyzeDependencyRisk(project, projectPlan) {
    const tasksWithDeps = projectPlan.tasks.filter(t => 
      t.dependencies && t.dependencies.length > 0
    );

    const criticalPathTasks = tasksWithDeps.filter(t => 
      t.dependencies.length > 2 || t.risk_flag === 'high'
    );

    if (criticalPathTasks.length > projectPlan.tasks.length * 0.3) {
      return {
        type: 'dependency',
        severity: 'high',
        description: 'Many tasks on critical path with dependencies',
        impact: 'High risk of cascading delays',
        mitigation: 'Monitor dependencies closely and have contingency plans'
      };
    }

    return null;
  }

  /**
   * Analyze SOW confidence risks
   * @param {Object} projectPlan - Project plan
   * @returns {Object|null} Confidence risk analysis
   */
  analyzeConfidenceRisk(projectPlan) {
    if (projectPlan.sow_confidence < 70) {
      return {
        type: 'confidence',
        severity: 'high',
        description: 'Low AI confidence in SOW extraction',
        impact: 'Project plan may have gaps or inaccuracies',
        mitigation: 'Manual review and validation required'
      };
    } else if (projectPlan.sow_confidence < 85) {
      return {
        type: 'confidence',
        severity: 'medium',
        description: 'Medium AI confidence in SOW extraction',
        impact: 'Some project plan elements may need adjustment',
        mitigation: 'Review critical path and deliverables carefully'
      };
    }

    return null;
  }

  /**
   * Calculate overall risk score
   * @param {Array} risks - All identified risks
   * @returns {number} Overall risk score (0-100)
   */
  calculateOverallRiskScore(risks) {
    let score = 0;
    
    risks.forEach(risk => {
      const weight = risk.severity === 'high' ? 30 : 
                     risk.severity === 'medium' ? 15 : 5;
      score += weight;
    });

    return Math.min(score, 100);
  }

  /**
   * Get risk level from score
   * @param {number} score - Risk score
   * @returns {string} Risk level
   */
  getRiskLevel(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Categorize risks by type
   * @param {Array} risks - All risks
   * @returns {Object} Categorized risks
   */
  categorizeRisks(risks) {
    const categorized = {
      timeline: [],
      complexity: [],
      resource: [],
      dependency: [],
      confidence: []
    };

    risks.forEach(risk => {
      if (categorized[risk.type]) {
        categorized[risk.type].push(risk);
      }
    });

    return categorized;
  }

  /**
   * Generate mitigation recommendations
   * @param {Array} risks - All risks
   * @returns {Array} Recommendations
   */
  generateMitigationRecommendations(risks) {
    const recommendations = new Set();

    risks.forEach(risk => {
      if (risk.mitigation) {
        recommendations.add(risk.mitigation);
      }
    });

    // Add general recommendations based on risk patterns
    const highRiskCount = risks.filter(r => r.severity === 'high').length;
    if (highRiskCount > 2) {
      recommendations.add('Consider project risk review with stakeholders');
    }

    if (risks.some(r => r.type === 'timeline')) {
      recommendations.add('Establish weekly timeline reviews');
    }

    if (risks.some(r => r.type === 'dependency')) {
      recommendations.add('Implement dependency tracking system');
    }

    return Array.from(recommendations);
  }

  /**
   * Store project risks in database
   * @param {string} projectId - Project ID
   * @param {Array} risks - Risk analysis results
   */
  async storeProjectRisks(projectId, risks) {
    for (const risk of risks) {
      await db('project_risks').insert({
        project_id: projectId,
        risk_type: risk.type,
        description: risk.description,
        severity: risk.severity,
        mitigation_plan: risk.mitigation,
        status: 'open'
      });
    }
  }

  /**
   * Update project with plan generation info
   * @param {string} projectId - Project ID
   * @param {Object} projectPlan - Generated plan
   * @param {Object} riskAnalysis - Risk analysis
   */
  async updateProjectWithPlan(projectId, projectPlan, riskAnalysis) {
    await db('projects')
      .where('id', projectId)
      .update({
        ai_generated: true,
        user_reviewed: false,
        risk_score: riskAnalysis.overall_score,
        updated_at: new Date()
      });
  }

  /**
   * Log plan generation activity
   * @param {string} projectId - Project ID
   * @param {Object} projectPlan - Generated plan
   */
  async logGenerationActivity(projectId, projectPlan) {
    await db('activity_log').insert({
      entity_type: 'project',
      entity_id: projectId,
      action_type: 'created',
      content: `Generated project plan with ${projectPlan.total_tasks} tasks across ${projectPlan.phases.length} phases`,
      metadata: {
        template_used: projectPlan.template_used,
        sow_confidence: projectPlan.sow_confidence,
        risk_score: projectPlan.risk_summary.overall_risk_score,
        tasks_generated: projectPlan.total_tasks
      }
    });
  }

  /**
   * Group tasks by role for analysis
   * @param {Array} tasks - All tasks
   * @returns {Object} Tasks grouped by role
   */
  groupTasksByRole(tasks) {
    const grouped = {};
    
    tasks.forEach(task => {
      if (!grouped[task.owner_role]) {
        grouped[task.owner_role] = [];
      }
      grouped[task.owner_role].push(task);
    });

    return grouped;
  }

  /**
   * Get project plan for review
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Project plan data
   */
  async getProjectPlanForReview(projectId) {
    try {
      // Get project details
      const project = await db('projects')
        .select('*')
        .where('id', projectId)
        .first();

      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      // Get tasks with dependencies
      const tasks = await db('tasks')
        .select('*')
        .where('project_id', projectId)
        .orderBy('sequence_order');

      // Get dependencies
      const dependencies = await db('task_dependencies')
        .select('*')
        .where('task_id', 'in', tasks.map(t => t.id));

      // Get project risks
      const risks = await db('project_risks')
        .select('*')
        .where('project_id', projectId);

      // Get SOW extraction
      const sowExtraction = await db('ai_extractions')
        .select('*')
        .where('id', project.ai_extraction_id)
        .first();

      return {
        project: {
          id: project.id,
          name: project.name,
          client_name: project.client_id, // Would need to join with clients table
          project_type: project.project_type,
          start_date: project.start_date,
          end_date: project.end_date,
          status: project.status,
          ai_generated: project.ai_generated,
          user_reviewed: project.user_reviewed,
          risk_score: project.risk_score
        },
        tasks: tasks.map(task => ({
          ...task,
          dependencies: dependencies
            .filter(d => d.task_id === task.id)
            .map(d => d.depends_on_task_id)
        })),
        risks: risks,
        sow_extraction: sowExtraction,
        summary: {
          total_tasks: tasks.length,
          high_risk_tasks: tasks.filter(t => t.risk_flag === 'high').length,
          total_duration: Math.max(...tasks.map(t => t.duration_days)),
          phases: [...new Set(tasks.map(t => t.phase))].length
        }
      };

    } catch (error) {
      console.error('Get project plan error:', error);
      throw new Error(`Failed to get project plan: ${error.message}`);
    }
  }

  /**
   * Confirm project plan after user review
   * @param {string} projectId - Project ID
   * @param {Object} confirmData - Confirmation data
   * @returns {Promise<Object>} Confirmation result
   */
  async confirmProjectPlan(projectId, confirmData) {
    try {
      // Update project as user reviewed
      await db('projects')
        .where('id', projectId)
        .update({
          user_reviewed: true,
          status: 'active', // Move to active status
          pm_id: confirmData.pm_id || null,
          updated_at: new Date()
        });

      // Log confirmation
      await db('activity_log').insert({
        entity_type: 'project',
        entity_id: projectId,
        action_type: 'updated',
        content: 'Project plan reviewed and confirmed by user',
        metadata: {
          confirmed_at: new Date(),
          pm_assigned: confirmData.pm_id || null
        }
      });

      return {
        project_id: projectId,
        status: 'confirmed',
        message: 'Project plan confirmed and activated',
        next_steps: [
          'Project manager assigned',
          'Team notifications sent',
          'Project execution can begin'
        ]
      };

    } catch (error) {
      console.error('Confirm project plan error:', error);
      throw new Error(`Failed to confirm project plan: ${error.message}`);
    }
  }
}

module.exports = ProjectPlanGenerator;
