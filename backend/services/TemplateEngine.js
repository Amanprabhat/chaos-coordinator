const db = require('../database/connection');

class TemplateEngine {
  constructor() {
    this.cache = new Map(); // Cache templates for performance
  }

  /**
   * Select appropriate template based on project type
   * @param {string} projectType - Type of project
   * @returns {Promise<Object>} Template data
   */
  async selectTemplate(projectType) {
    try {
      // Check cache first
      const cacheKey = `template_${projectType}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // Query database for active template
      const template = await db('templates')
        .select('*')
        .where('project_type', projectType)
        .where('is_active', true)
        .first();

      if (!template) {
        throw new Error(`No active template found for project type: ${projectType}`);
      }

      // Get template tasks
      const templateTasks = await db('template_tasks')
        .select('*')
        .where('template_id', template.id)
        .orderBy('sequence_order');

      const templateData = {
        ...template,
        tasks: templateTasks
      };

      // Cache the result
      this.cache.set(cacheKey, templateData);

      return templateData;

    } catch (error) {
      console.error('Template selection error:', error);
      throw new Error(`Failed to select template: ${error.message}`);
    }
  }

  /**
   * Merge template with SOW extraction
   * @param {Object} template - Template data
   * @param {Object} sowExtraction - AI-extracted SOW data
   * @param {Object} projectInfo - Project basic info
   * @returns {Promise<Object>} Merged project plan
   */
  async mergeWithSOW(template, sowExtraction, projectInfo) {
    try {
      console.log(`Merging template with SOW for project: ${projectInfo.id}`);

      const mergedTasks = [];
      const phaseMap = new Map();
      let taskSequence = 1;

      // 1. Process template tasks
      for (const templateTask of template.tasks) {
        const mergedTask = this.processTemplateTask(
          templateTask, 
          sowExtraction, 
          projectInfo, 
          taskSequence
        );
        
        mergedTasks.push(mergedTask);
        
        // Track phases
        if (!phaseMap.has(templateTask.phase)) {
          phaseMap.set(templateTask.phase, []);
        }
        phaseMap.get(templateTask.phase).push(mergedTask);
        
        taskSequence++;
      }

      // 2. Add SOW-specific tasks if explicitly required
      const sowSpecificTasks = this.extractSOWSpecificTasks(sowExtraction, taskSequence);
      mergedTasks.push(...sowSpecificTasks);

      // 3. Calculate timeline and adjust dates
      const timelineData = this.calculateTimeline(
        mergedTasks, 
        projectInfo.start_date, 
        projectInfo.end_date,
        template.buffer_percentage
      );

      // 4. Apply risk flags based on SOW analysis
      const riskFlaggedTasks = this.applyRiskFlags(mergedTasks, sowExtraction);

      // 5. Structure final project plan
      const projectPlan = {
        project_id: projectInfo.id,
        template_used: template.name,
        sow_confidence: sowExtraction.confidence_score,
        total_tasks: riskFlaggedTasks.length,
        phases: Array.from(phaseMap.entries()).map(([phase, tasks]) => ({
          name: phase,
          tasks: tasks.length,
          duration_days: this.calculatePhaseDuration(tasks)
        })),
        tasks: riskFlaggedTasks.map(task => ({
          ...task,
          ...timelineData.taskDates[task.sequence_order]
        })),
        timeline: timelineData,
        risk_summary: this.generateRiskSummary(riskFlaggedTasks, sowExtraction),
        warnings: this.generateWarnings(sowExtraction, template)
      };

      return projectPlan;

    } catch (error) {
      console.error('Template merge error:', error);
      throw new Error(`Failed to merge template with SOW: ${error.message}`);
    }
  }

  /**
   * Process individual template task
   * @param {Object} templateTask - Template task
   * @param {Object} sowExtraction - SOW extraction data
   * @param {Object} projectInfo - Project info
   * @param {number} sequence - Task sequence number
   * @returns {Object} Processed task
   */
  processTemplateTask(templateTask, sowExtraction, projectInfo, sequence) {
    const task = {
      sequence_order: sequence,
      template_task_id: templateTask.id,
      name: templateTask.name,
      description: templateTask.description,
      phase: templateTask.phase,
      duration_days: templateTask.duration_days,
      owner_role: templateTask.owner_role,
      is_parallel: templateTask.is_parallel,
      dependencies: templateTask.dependencies || [],
      status: 'todo',
      source: 'template'
    };

    // Adjust duration based on SOW if applicable
    const sowAdjustment = this.calculateSOWAdjustment(task, sowExtraction);
    if (sowAdjustment.duration_days) {
      task.duration_days = sowAdjustment.duration_days;
      task.sow_adjustment = true;
      task.original_duration = templateTask.duration_days;
    }

    // Enhance description with SOW context
    if (sowExtraction.extracted_scope) {
      task.description = this.enhanceDescriptionWithSOW(
        task.description, 
        sowExtraction.extracted_scope
      );
    }

    return task;
  }

  /**
   * Extract SOW-specific tasks that are not in template
   * @param {Object} sowExtraction - SOW extraction data
   * @param {number} startSequence - Starting sequence number
   * @returns {Array} SOW-specific tasks
   */
  extractSOWSpecificTasks(sowExtraction, startSequence) {
    const sowTasks = [];
    let sequence = startSequence;

    // Extract tasks from SOW deliverables that aren't covered by template
    const sowDeliverables = sowExtraction.extracted_deliverables || [];
    
    for (const deliverable of sowDeliverables) {
      // Check if this deliverable is already covered by template
      if (!this.isDeliverableCovered(deliverable.name)) {
        const task = {
          sequence_order: sequence,
          name: deliverable.name,
          description: deliverable.description || `Deliverable: ${deliverable.name}`,
          phase: this.inferPhase(deliverable.name),
          duration_days: deliverable.estimated_effort_days || 5,
          owner_role: this.inferOwnerRole(deliverable.name),
          is_parallel: false,
          dependencies: [],
          status: 'todo',
          source: 'sow_specific'
        };

        sowTasks.push(task);
        sequence++;
      }
    }

    return sowTasks;
  }

  /**
   * Calculate project timeline
   * @param {Array} tasks - All tasks
   * @param {string} startDate - Project start date
   * @param {string} endDate - Project end date
   * @param {number} bufferPercentage - Buffer percentage
   * @returns {Object} Timeline data
   */
  calculateTimeline(tasks, startDate, endDate, bufferPercentage) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    // Calculate working days (excluding weekends)
    const workingDays = this.calculateWorkingDays(start, end);
    const bufferDays = Math.floor(workingDays * (bufferPercentage / 100));
    const availableDays = workingDays - bufferDays;

    // Calculate task dates
    const taskDates = {};
    const phases = new Map();
    let currentDate = new Date(start);

    // Group tasks by phase
    tasks.forEach(task => {
      if (!phases.has(task.phase)) {
        phases.set(task.phase, []);
      }
      phases.get(task.phase).push(task);
    });

    // Process phases sequentially
    let sequence = 1;
    for (const [phase, phaseTasks] of phases) {
      const phaseStart = new Date(currentDate);
      let phaseEnd = new Date(currentDate);

      // Process tasks within phase
      const parallelTasks = [];
      const sequentialTasks = [];

      phaseTasks.forEach(task => {
        if (task.is_parallel) {
          parallelTasks.push(task);
        } else {
          sequentialTasks.push(task);
        }
      });

      // Process parallel tasks (they start at the same time)
      if (parallelTasks.length > 0) {
        const maxParallelDuration = Math.max(...parallelTasks.map(t => t.duration_days));
        
        parallelTasks.forEach(task => {
          const taskStart = new Date(currentDate);
          const taskEnd = new Date(currentDate);
          taskEnd.setDate(taskEnd.getDate() + task.duration_days);

          taskDates[task.sequence_order] = {
            start_date: taskStart.toISOString().split('T')[0],
            end_date: taskEnd.toISOString().split('T')[0],
            working_days: task.duration_days
          };

          phaseEnd = taskEnd > phaseEnd ? taskEnd : phaseEnd;
        });

        currentDate = new Date(phaseEnd);
      }

      // Process sequential tasks
      sequentialTasks.forEach(task => {
        const taskStart = new Date(currentDate);
        const taskEnd = new Date(currentDate);
        taskEnd.setDate(taskEnd.getDate() + task.duration_days);

        taskDates[task.sequence_order] = {
          start_date: taskStart.toISOString().split('T')[0],
          end_date: taskEnd.toISOString().split('T')[0],
          working_days: task.duration_days
        };

        currentDate = new Date(taskEnd);
        phaseEnd = taskEnd;
      });

      // Store phase info
      phases.set(phase, {
        start_date: phaseStart.toISOString().split('T')[0],
        end_date: phaseEnd.toISOString().split('T')[0],
        duration_days: Math.ceil((phaseEnd - phaseStart) / (1000 * 60 * 60 * 24))
      });
    }

    return {
      total_calendar_days: totalDays,
      total_working_days: workingDays,
      buffer_days: bufferDays,
      actual_working_days: availableDays,
      phases: Object.fromEntries(phases),
      task_dates: taskDates
    };
  }

  /**
   * Apply risk flags to tasks based on SOW analysis
   * @param {Array} tasks - All tasks
   * @param {Object} sowExtraction - SOW extraction data
   * @returns {Array} Tasks with risk flags
   */
  applyRiskFlags(tasks, sowExtraction) {
    const risks = sowExtraction.extracted_risks || [];
    const dependencies = sowExtraction.extracted_dependencies || [];

    return tasks.map(task => {
      const riskFlags = [];
      let highestRisk = 'none';

      // Check for timeline risks
      if (risks.some(r => r.type === 'timeline' && r.severity === 'high')) {
        if (task.duration_days > 10) {
          riskFlags.push('timeline_pressure');
          highestRisk = 'high';
        }
      }

      // Check for dependency risks
      if (dependencies.some(d => d.critical && task.phase === 'setup')) {
        riskFlags.push('dependency_critical');
        highestRisk = highestRisk === 'none' ? 'medium' : highestRisk;
      }

      // Check for technical complexity risks
      if (risks.some(r => r.type === 'technical' && r.severity === 'high') && 
          task.owner_role === 'technical') {
        riskFlags.push('technical_complexity');
        highestRisk = 'high';
      }

      // Check for resource risks
      if (risks.some(r => r.type === 'resource') && task.duration_days > 5) {
        riskFlags.push('resource_constraint');
        highestRisk = highestRisk === 'none' ? 'medium' : highestRisk;
      }

      return {
        ...task,
        risk_flags: riskFlags,
        risk_flag: highestRisk
      };
    });
  }

  /**
   * Generate risk summary
   * @param {Array} tasks - Tasks with risk flags
   * @param {Object} sowExtraction - SOW extraction
   * @returns {Object} Risk summary
   */
  generateRiskSummary(tasks, sowExtraction) {
    const riskCounts = {
      none: 0,
      low: 0,
      medium: 0,
      high: 0
    };

    tasks.forEach(task => {
      riskCounts[task.risk_flag]++;
    });

    const sowRisks = sowExtraction.extracted_risks || [];
    const criticalDependencies = (sowExtraction.extracted_dependencies || [])
      .filter(d => d.critical).length;

    return {
      overall_risk_score: this.calculateOverallRiskScore(riskCounts, sowRisks),
      task_risk_distribution: riskCounts,
      critical_dependencies: criticalDependencies,
      sow_risks_count: sowRisks.length,
      high_risk_tasks: tasks.filter(t => t.risk_flag === 'high').length,
      recommendations: this.generateRiskRecommendations(riskCounts, sowRisks)
    };
  }

  /**
   * Generate warnings for the project plan
   * @param {Object} sowExtraction - SOW extraction
   * @param {Object} template - Template used
   * @returns {Array} Warning messages
   */
  generateWarnings(sowExtraction, template) {
    const warnings = [];

    // Low confidence warning
    if (sowExtraction.confidence_score < 70) {
      warnings.push({
        type: 'low_confidence',
        message: 'AI confidence score is below 70%. Manual review recommended.',
        severity: 'high'
      });
    }

    // Missing scope warning
    if (!sowExtraction.extracted_scope || sowExtraction.extracted_scope.length < 50) {
      warnings.push({
        type: 'missing_scope',
        message: 'Project scope is not clearly defined in SOW.',
        severity: 'high'
      });
    }

    // Timeline warning
    if (!sowExtraction.extracted_timeline || !sowExtraction.extracted_timeline.total_days) {
      warnings.push({
        type: 'missing_timeline',
        message: 'Timeline information is missing from SOW.',
        severity: 'medium'
      });
    }

    // Template mismatch warning
    const sowDeliverables = sowExtraction.extracted_deliverables || [];
    const uncoveredDeliverables = sowDeliverables.filter(d => 
      !this.isDeliverableCovered(d.name)
    );
    
    if (uncoveredDeliverables.length > 0) {
      warnings.push({
        type: 'template_gap',
        message: `${uncoveredDeliverables.length} deliverables from SOW are not covered by template.`,
        severity: 'medium'
      });
    }

    return warnings;
  }

  // Helper methods
  calculateWorkingDays(startDate, endDate) {
    let days = 0;
    let current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
        days++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }

  calculateSOWAdjustment(task, sowExtraction) {
    // Logic to adjust task duration based on SOW analysis
    const adjustment = {};
    
    // Example: If SOW mentions complexity, increase duration
    if (sowExtraction.extracted_risks?.some(r => r.type === 'technical')) {
      if (task.owner_role === 'technical') {
        adjustment.duration_days = Math.ceil(task.duration_days * 1.2);
      }
    }
    
    return adjustment;
  }

  enhanceDescriptionWithSOW(originalDescription, sowScope) {
    // Enhance task description with SOW context
    return `${originalDescription}\n\nContext: ${sowScope.substring(0, 200)}...`;
  }

  isDeliverableCovered(deliverableName) {
    // Check if deliverable is covered by standard template
    const standardDeliverables = [
      'deployment', 'training', 'documentation', 'support', 'testing', 'setup'
    ];
    
    const name = deliverableName.toLowerCase();
    return standardDeliverables.some(standard => name.includes(standard));
  }

  inferPhase(deliverableName) {
    const name = deliverableName.toLowerCase();
    
    if (name.includes('plan') || name.includes('requirement')) return 'planning';
    if (name.includes('setup') || name.includes('environment')) return 'setup';
    if (name.includes('deploy') || name.includes('implement')) return 'implementation';
    if (name.includes('test') || name.includes('validate')) return 'testing';
    if (name.includes('train') || name.includes('documentation')) return 'training';
    
    return 'implementation'; // Default
  }

  inferOwnerRole(deliverableName) {
    const name = deliverableName.toLowerCase();
    
    if (name.includes('technical') || name.includes('deploy') || name.includes('integration')) {
      return 'technical';
    }
    if (name.includes('train') || name.includes('support')) {
      return 'csm';
    }
    if (name.includes('document') || name.includes('plan')) {
      return 'pm';
    }
    
    return 'pm'; // Default
  }

  calculatePhaseDuration(tasks) {
    return tasks.reduce((total, task) => total + task.duration_days, 0);
  }

  calculateOverallRiskScore(riskCounts, sowRisks) {
    let score = 0;
    
    // Weight task risks
    score += riskCounts.high * 10;
    score += riskCounts.medium * 5;
    score += riskCounts.low * 2;
    
    // Weight SOW risks
    score += sowRisks.filter(r => r.severity === 'high').length * 8;
    score += sowRisks.filter(r => r.severity === 'medium').length * 4;
    score += sowRisks.filter(r => r.severity === 'low').length * 2;
    
    return Math.min(score, 100);
  }

  generateRiskRecommendations(riskCounts, sowRisks) {
    const recommendations = [];
    
    if (riskCounts.high > 0) {
      recommendations.push('Focus on high-risk tasks first');
    }
    
    if (sowRisks.some(r => r.type === 'timeline')) {
      recommendations.push('Consider adding buffer time for critical path tasks');
    }
    
    if (sowRisks.some(r => r.type === 'dependency')) {
      recommendations.push('Establish clear dependency tracking and communication');
    }
    
    return recommendations;
  }

  // Clear cache method
  clearCache() {
    this.cache.clear();
  }
}

module.exports = TemplateEngine;
