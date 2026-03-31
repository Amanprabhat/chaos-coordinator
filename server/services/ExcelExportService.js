const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;

class ExcelExportService {
  constructor() {
    this.defaultColumns = [
      { header: 'Task ID', key: 'task_id', width: 15 },
      { header: 'Task Name', key: 'task_name', width: 30 },
      { header: 'Phase', key: 'phase', width: 15 },
      { header: 'Owner', key: 'owner_role', width: 15 },
      { header: 'Start Date', key: 'start_date', width: 15 },
      { header: 'End Date', key: 'end_date', width: 15 },
      { header: 'Duration', key: 'duration_days', width: 12 },
      { header: 'Dependencies', key: 'dependencies', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Risk Flag', key: 'risk_flag', width: 12 },
      { header: 'Progress', key: 'progress_percentage', width: 12 },
      { header: 'Notes', key: 'notes', width: 30 }
    ];
  }

  /**
   * Export project plan to Excel
   * @param {string} projectId - Project ID
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result with file info
   */
  async exportProjectPlan(projectId, options = {}) {
    try {
      console.log(`Starting Excel export for project: ${projectId}`);

      // 1. Get project data
      const projectData = await this.getProjectData(projectId);
      
      // 2. Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      
      // 3. Create main project plan worksheet
      const planWorksheet = this.createProjectPlanWorksheet(workbook, projectData);
      
      // 4. Create additional worksheets if requested
      if (options.includeRisks) {
        this.createRisksWorksheet(workbook, projectData);
      }
      
      if (options.includeTimeline) {
        this.createTimelineWorksheet(workbook, projectData);
      }
      
      if (options.includeSummary) {
        this.createSummaryWorksheet(workbook, projectData);
      }
      
      // 5. Generate filename
      const filename = this.generateFilename(projectData.project, options);
      const filePath = path.join(__dirname, '../../exports', filename);
      
      // 6. Ensure exports directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // 7. Save workbook
      await workbook.xlsx.writeFile(filePath);
      
      // 8. Log export activity
      await this.logExportActivity(projectId, filename, options);

      return {
        success: true,
        filename: filename,
        file_path: filePath,
        file_size: (await fs.stat(filePath)).size,
        worksheets: workbook.worksheets.length,
        export_date: new Date().toISOString(),
        download_url: `/api/exports/download/${filename}`
      };

    } catch (error) {
      console.error('Excel export error:', error);
      throw new Error(`Failed to export project plan: ${error.message}`);
    }
  }

  /**
   * Get comprehensive project data for export
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Project data
   */
  async getProjectData(projectId) {
    const db = require('../database/connection');
    
    // Get project details
    const project = await db('projects')
      .select('p.*', 'c.name as client_name')
      .from('projects as p')
      .leftJoin('clients as c', 'p.client_id', 'c.id')
      .where('p.id', projectId)
      .first();

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Get tasks with dependencies
    const tasks = await db('tasks')
      .select('*')
      .where('project_id', projectId)
      .orderBy('sequence_order');

    // Get dependencies for each task
    for (const task of tasks) {
      const dependencies = await db('task_dependencies as td')
        .select('dt.sequence_order as depends_on_sequence')
        .join('tasks as dt', 'td.depends_on_task_id', 'dt.id')
        .where('td.task_id', task.id);

      task.dependencies = dependencies.map(d => `Task ${d.depends_on_sequence}`).join(', ');
    }

    // Get project risks
    const risks = await db('project_risks')
      .select('*')
      .where('project_id', projectId)
      .orderBy('severity', 'desc');

    // Get activity log
    const activities = await db('activity_log')
      .select('*')
      .where('entity_type', 'project')
      .where('entity_id', projectId)
      .orderBy('created_at', 'desc')
      .limit(50);

    return {
      project,
      tasks,
      risks,
      activities,
      export_date: new Date()
    };
  }

  /**
   * Create main project plan worksheet
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {Object} projectData - Project data
   * @returns {ExcelJS.Worksheet} Created worksheet
   */
  createProjectPlanWorksheet(workbook, projectData) {
    const worksheet = workbook.addWorksheet('Project Plan');

    // Set up columns
    worksheet.columns = this.defaultColumns;

    // Add header styling
    this.styleHeaderRow(worksheet.getRow(1));

    // Add project information at the top
    this.addProjectInfo(worksheet, projectData.project);

    // Add tasks data
    let rowIndex = 4; // Start after project info
    
    projectData.tasks.forEach(task => {
      const row = worksheet.addRow({
        task_id: `T${task.sequence_order}`,
        task_name: task.name,
        phase: task.phase,
        owner_role: task.owner_role,
        start_date: this.formatDate(task.start_date),
        end_date: this.formatDate(task.end_date),
        duration_days: task.duration_days,
        dependencies: task.dependencies || 'None',
        status: this.formatStatus(task.status),
        risk_flag: this.formatRiskFlag(task.risk_flag),
        progress_percentage: `${task.progress_percentage || 0}%`,
        notes: task.notes || ''
      });

      // Style based on risk level
      this.styleTaskRow(row, task);

      rowIndex++;
    });

    // Add summary at the bottom
    this.addTaskSummary(worksheet, rowIndex + 2, projectData.tasks);

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = column.width || 15;
    });

    return worksheet;
  }

  /**
   * Create risks worksheet
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {Object} projectData - Project data
   */
  createRisksWorksheet(workbook, projectData) {
    const worksheet = workbook.addWorksheet('Risk Analysis');

    // Set up risk columns
    worksheet.columns = [
      { header: 'Risk Type', key: 'risk_type', width: 15 },
      { header: 'Severity', key: 'severity', width: 12 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Mitigation Plan', key: 'mitigation_plan', width: 40 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Created', key: 'created_at', width: 15 }
    ];

    // Style header
    this.styleHeaderRow(worksheet.getRow(1));

    // Add risks data
    projectData.risks.forEach((risk, index) => {
      const row = worksheet.addRow({
        risk_type: risk.risk_type,
        severity: risk.severity,
        description: risk.description,
        mitigation_plan: risk.mitigation_plan || 'Not defined',
        status: risk.status,
        created_at: this.formatDate(risk.created_at)
      });

      // Color code by severity
      this.styleRiskRow(row, risk.severity);
    });

    // Add risk summary
    this.addRiskSummary(worksheet, projectData.risks.length + 3, projectData.risks);
  }

  /**
   * Create timeline worksheet
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {Object} projectData - Project data
   */
  createTimelineWorksheet(workbook, projectData) {
    const worksheet = workbook.addWorksheet('Timeline');

    // Set up timeline columns
    worksheet.columns = [
      { header: 'Phase', key: 'phase', width: 20 },
      { header: 'Task Count', key: 'task_count', width: 12 },
      { header: 'Total Duration', key: 'total_duration', width: 15 },
      { header: 'Start Date', key: 'start_date', width: 15 },
      { header: 'End Date', key: 'end_date', width: 15 },
      { header: 'Critical Path', key: 'critical_path', width: 15 }
    ];

    // Style header
    this.styleHeaderRow(worksheet.getRow(1));

    // Group tasks by phase
    const phases = this.groupTasksByPhase(projectData.tasks);
    
    // Add phase data
    Object.entries(phases).forEach(([phaseName, phaseTasks], index) => {
      const totalDuration = phaseTasks.reduce((sum, task) => sum + task.duration_days, 0);
      const startDate = new Date(Math.min(...phaseTasks.map(t => new Date(t.start_date))));
      const endDate = new Date(Math.max(...phaseTasks.map(t => new Date(t.end_date))));
      
      worksheet.addRow({
        phase: phaseName,
        task_count: phaseTasks.length,
        total_duration: `${totalDuration} days`,
        start_date: this.formatDate(startDate),
        end_date: this.formatDate(endDate),
        critical_path: phaseTasks.some(t => t.risk_flag === 'high') ? 'Yes' : 'No'
      });
    });

    // Add Gantt chart style visualization
    this.addTimelineVisualization(worksheet, phases);
  }

  /**
   * Create summary worksheet
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {Object} projectData - Project data
   */
  createSummaryWorksheet(workbook, projectData) {
    const worksheet = workbook.addWorksheet('Summary');

    // Project Overview Section
    worksheet.addRow('PROJECT OVERVIEW');
    worksheet.addRow('');
    worksheet.addRow('Project Name:', projectData.project.name);
    worksheet.addRow('Client:', projectData.project.client_name);
    worksheet.addRow('Project Type:', projectData.project.project_type);
    worksheet.addRow('Start Date:', this.formatDate(projectData.project.start_date));
    worksheet.addRow('End Date:', this.formatDate(projectData.project.end_date));
    worksheet.addRow('Status:', projectData.project.status);
    worksheet.addRow('Risk Score:', `${projectData.project.risk_score || 0}/100`);
    worksheet.addRow('');

    // Task Summary Section
    worksheet.addRow('TASK SUMMARY');
    worksheet.addRow('');
    worksheet.addRow('Total Tasks:', projectData.tasks.length);
    worksheet.addRow('High Risk Tasks:', projectData.tasks.filter(t => t.risk_flag === 'high').length);
    worksheet.addRow('Completed Tasks:', projectData.tasks.filter(t => t.status === 'completed').length);
    worksheet.addRow('In Progress Tasks:', projectData.tasks.filter(t => t.status === 'in_progress').length);
    worksheet.addRow('Pending Tasks:', projectData.tasks.filter(t => t.status === 'todo').length);
    worksheet.addRow('');

    // Risk Summary Section
    worksheet.addRow('RISK SUMMARY');
    worksheet.addRow('');
    worksheet.addRow('Total Risks:', projectData.risks.length);
    worksheet.addRow('High Severity Risks:', projectData.risks.filter(r => r.severity === 'high').length);
    worksheet.addRow('Medium Severity Risks:', projectData.risks.filter(r => r.severity === 'medium').length);
    worksheet.addRow('Low Severity Risks:', projectData.risks.filter(r => r.severity === 'low').length);
    worksheet.addRow('');

    // Recent Activities Section
    worksheet.addRow('RECENT ACTIVITIES');
    worksheet.addRow('');
    
    // Activity columns
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Action', key: 'action', width: 15 },
      { header: 'Description', key: 'description', width: 40 }
    ];

    projectData.activities.slice(0, 10).forEach(activity => {
      worksheet.addRow({
        date: this.formatDate(activity.created_at),
        action: activity.action_type,
        description: activity.content
      });
    });

    // Style the summary
    this.styleSummaryWorksheet(worksheet);
  }

  /**
   * Style header row with formatting
   * @param {ExcelJS.Row} headerRow - Header row to style
   */
  styleHeaderRow(headerRow) {
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF366092' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    headerRow.height = 25;
  }

  /**
   * Style task row based on risk level
   * @param {ExcelJS.Row} row - Task row to style
   * @param {Object} task - Task data
   */
  styleTaskRow(row, task) {
    // Apply risk-based coloring
    if (task.risk_flag === 'high') {
      row.eachCell((cell, colNumber) => {
        if (colNumber === 10) { // Risk Flag column
          cell.font = { bold: true, color: { argb: 'FFFF0000' } };
        }
      });
    } else if (task.risk_flag === 'medium') {
      row.eachCell((cell, colNumber) => {
        if (colNumber === 10) { // Risk Flag column
          cell.font = { bold: true, color: { argb: 'FFFFA500' } };
        }
      });
    }

    // Add borders to all cells
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  }

  /**
   * Style risk row based on severity
   * @param {ExcelJS.Row} row - Risk row to style
   * @param {string} severity - Risk severity
   */
  styleRiskRow(row, severity) {
    let color;
    switch (severity) {
      case 'high':
        color = 'FFFFCCCC';
        break;
      case 'medium':
        color = 'FFFFF2CC';
        break;
      case 'low':
        color = 'FFFFFFCC';
        break;
      default:
        color = 'FFFFFFFF';
    }

    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  }

  /**
   * Add project information to worksheet
   * @param {ExcelJS.Worksheet} worksheet - Worksheet to add info to
   * @param {Object} project - Project data
   */
  addProjectInfo(worksheet, project) {
    // Merge cells for project title
    worksheet.mergeCells('A1:L1');
    worksheet.getCell('A1').value = `Project Plan: ${project.name}`;
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Add project details
    worksheet.mergeCells('A2:L2');
    worksheet.getCell('A2').value = `Client: ${project.client_name} | Type: ${project.project_type} | ${this.formatDate(project.start_date)} - ${this.formatDate(project.end_date)}`;
    worksheet.getCell('A2').font = { italic: true };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    // Add empty row before tasks
    worksheet.addRow('');
  }

  /**
   * Add task summary at the bottom
   * @param {ExcelJS.Worksheet} worksheet - Worksheet to add summary to
   * @param {number} startRow - Starting row for summary
   * @param {Array} tasks - All tasks
   */
  addTaskSummary(worksheet, startRow, tasks) {
    worksheet.addRow('TASK SUMMARY');
    worksheet.addRow('');

    const summary = {
      'Total Tasks:': tasks.length,
      'Completed:': tasks.filter(t => t.status === 'completed').length,
      'In Progress:': tasks.filter(t => t.status === 'in_progress').length,
      'Pending:': tasks.filter(t => t.status === 'todo').length,
      'High Risk:': tasks.filter(t => t.risk_flag === 'high').length,
      'Medium Risk:': tasks.filter(t => t.risk_flag === 'medium').length,
      'Low Risk:': tasks.filter(t => t.risk_flag === 'low').length
    };

    Object.entries(summary).forEach(([label, value]) => {
      const row = worksheet.addRow([label, value]);
      row.getCell(1).font = { bold: true };
    });
  }

  /**
   * Add risk summary
   * @param {ExcelJS.Worksheet} worksheet - Worksheet to add summary to
   * @param {number} startRow - Starting row for summary
   * @param {Array} risks - All risks
   */
  addRiskSummary(worksheet, startRow, risks) {
    worksheet.addRow('RISK SUMMARY');
    worksheet.addRow('');

    const summary = {
      'Total Risks:': risks.length,
      'High Severity:': risks.filter(r => r.severity === 'high').length,
      'Medium Severity:': risks.filter(r => r.severity === 'medium').length,
      'Low Severity:': risks.filter(r => r.severity === 'low').length,
      'Open Risks:': risks.filter(r => r.status === 'open').length,
      'Mitigated:': risks.filter(r => r.status === 'mitigated').length
    };

    Object.entries(summary).forEach(([label, value]) => {
      const row = worksheet.addRow([label, value]);
      row.getCell(1).font = { bold: true };
    });
  }

  /**
   * Add timeline visualization
   * @param {ExcelJS.Worksheet} worksheet - Worksheet to add visualization to
   * @param {Object} phases - Phases data
   */
  addTimelineVisualization(worksheet, phases) {
    // This would create a simple Gantt chart-like visualization
    // For now, just add a simple timeline representation
    worksheet.addRow('');
    worksheet.addRow('TIMELINE VISUALIZATION');
    worksheet.addRow('');

    Object.entries(phases).forEach(([phaseName, phaseTasks], index) => {
      const totalDuration = phaseTasks.reduce((sum, task) => sum + task.duration_days, 0);
      const bar = '█'.repeat(Math.min(totalDuration / 5, 20)); // Simple bar chart
      
      worksheet.addRow([phaseName, bar, `${totalDuration} days`]);
    });
  }

  /**
   * Style summary worksheet
   * @param {ExcelJS.Worksheet} worksheet - Worksheet to style
   */
  styleSummaryWorksheet(worksheet) {
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 15) { // Header section
        row.eachCell((cell) => {
          if (cell.value && cell.value.toString().includes('PROJECT OVERVIEW') ||
              cell.value && cell.value.toString().includes('TASK SUMMARY') ||
              cell.value && cell.value.toString().includes('RISK SUMMARY') ||
              cell.value && cell.value.toString().includes('RECENT ACTIVITIES')) {
            cell.font = { bold: true, size: 14 };
          } else if (cell.value && cell.value.toString().endsWith(':')) {
            cell.font = { bold: true };
          }
        });
      }
    });
  }

  /**
   * Generate filename for export
   * @param {Object} project - Project data
   * @param {Object} options - Export options
   * @returns {string} Generated filename
   */
  generateFilename(project, options) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const clientName = project.client_name.replace(/[^a-zA-Z0-9]/g, '_');
    const projectName = project.name.replace(/[^a-zA-Z0-9]/g, '_');
    
    let filename = `${clientName}_${projectName}_${timestamp}`;
    
    if (options.includeRisks) filename += '_with_risks';
    if (options.includeTimeline) filename += '_with_timeline';
    if (options.includeSummary) filename += '_with_summary';
    
    return `${filename}.xlsx`;
  }

  /**
   * Format date for Excel
   * @param {string|Date} date - Date to format
   * @returns {string} Formatted date
   */
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  }

  /**
   * Format status for display
   * @param {string} status - Status value
   * @returns {string} Formatted status
   */
  formatStatus(status) {
    return status ? status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';
  }

  /**
   * Format risk flag for display
   * @param {string} riskFlag - Risk flag value
   * @returns {string} Formatted risk flag
   */
  formatRiskFlag(riskFlag) {
    return riskFlag ? riskFlag.toUpperCase() : 'NONE';
  }

  /**
   * Group tasks by phase
   * @param {Array} tasks - All tasks
   * @returns {Object} Tasks grouped by phase
   */
  groupTasksByPhase(tasks) {
    const phases = {};
    
    tasks.forEach(task => {
      if (!phases[task.phase]) {
        phases[task.phase] = [];
      }
      phases[task.phase].push(task);
    });

    return phases;
  }

  /**
   * Log export activity
   * @param {string} projectId - Project ID
   * @param {string} filename - Generated filename
   * @param {Object} options - Export options
   */
  async logExportActivity(projectId, filename, options) {
    const db = require('../database/connection');
    
    await db('activity_log').insert({
      entity_type: 'project',
      entity_id: projectId,
      action_type: 'exported',
      content: `Project plan exported to Excel: ${filename}`,
      metadata: {
        filename: filename,
        export_options: options,
        export_date: new Date().toISOString()
      }
    });
  }

  /**
   * Get export download URL
   * @param {string} filename - Filename to download
   * @returns {string} Download URL
   */
  getDownloadUrl(filename) {
    return `/api/exports/download/${filename}`;
  }

  /**
   * Clean up old export files
   * @param {number} maxAge - Maximum age in days
   */
  async cleanupOldExports(maxAge = 7) {
    try {
      const exportsDir = path.join(__dirname, '../../exports');
      const files = await fs.readdir(exportsDir);
      const cutoffTime = Date.now() - (maxAge * 24 * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(exportsDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          console.log(`Cleaned up old export: ${file}`);
        }
      }
    } catch (error) {
      console.error('Export cleanup error:', error);
    }
  }
}

module.exports = ExcelExportService;
