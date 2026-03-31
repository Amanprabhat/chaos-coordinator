const fs = require('fs').promises;
const path = require('path');

class SOWParsingService {
  constructor() {
    this.aiService = null; // Would be initialized with actual AI service
  }

  /**
   * Parse SOW document using AI
   * @param {string} sowDocumentId - SOW document ID
   * @param {string} filePath - Path to SOW file
   * @returns {Promise<Object>} Parsed SOW data
   */
  async parseSOW(sowDocumentId, filePath) {
    try {
      console.log(`Starting SOW parsing for document: ${sowDocumentId}`);
      
      // 1. Extract text from document
      const documentText = await this.extractTextFromDocument(filePath);
      
      // 2. Send to AI for structured extraction
      const aiResponse = await this.extractWithAI(documentText);
      
      // 3. Validate and structure the response
      const structuredData = this.validateAndStructureResponse(aiResponse);
      
      // 4. Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(structuredData, documentText);
      
      return {
        sow_document_id: sowDocumentId,
        confidence_score: confidenceScore,
        extracted_scope: structuredData.scope,
        extracted_deliverables: structuredData.deliverables,
        extracted_risks: structuredData.risks,
        extracted_dependencies: structuredData.dependencies,
        extracted_timeline: structuredData.timeline,
        raw_response: aiResponse,
        processing_time_ms: Date.now() // Would track actual processing time
      };

    } catch (error) {
      console.error('SOW parsing error:', error);
      
      // Return fallback data on error
      return this.getFallbackExtraction(sowDocumentId, error);
    }
  }

  /**
   * Extract text from document (PDF/Word)
   * @param {string} filePath - Path to document
   * @returns {Promise<string>} Extracted text
   */
  async extractTextFromDocument(filePath) {
    try {
      const fileExtension = path.extname(filePath).toLowerCase();
      
      switch (fileExtension) {
        case '.pdf':
          return await this.extractFromPDF(filePath);
        case '.doc':
        case '.docx':
          return await this.extractFromWord(filePath);
        default:
          throw new Error(`Unsupported file type: ${fileExtension}`);
      }
    } catch (error) {
      console.error('Text extraction error:', error);
      throw new Error('Failed to extract text from document');
    }
  }

  /**
   * Extract text from PDF file
   * @param {string} filePath - Path to PDF
   * @returns {Promise<string>} Extracted text
   */
  async extractFromPDF(filePath) {
    // In production, you'd use libraries like pdf-parse or pdf2pic
    // For now, return mock text
    return `
      STATEMENT OF WORK
      
      Client: Acme Corporation
      Project: CRM Implementation
      Duration: 90 days
      Start Date: 2024-03-01
      End Date: 2024-05-30
      
      SCOPE:
      This project involves the implementation of a comprehensive CRM system for Acme Corporation.
      The implementation includes software deployment, data migration, user training, and go-live support.
      
      DELIVERABLES:
      1. CRM Software Deployment
      2. Data Migration from existing systems
      3. User Training Sessions (2 days)
      4. Technical Documentation
      5. Go-live Support (1 week)
      
      REQUIREMENTS:
      - Integration with existing ERP system
      - Custom reporting dashboard
      - Mobile app access for sales team
      - Data security and compliance
      
      RISKS:
      - Timeline constraints due to business cycle
      - Resource availability during peak periods
      - Technical complexity of ERP integration
      
      DEPENDENCIES:
      - Client infrastructure readiness
      - Third-party API access
      - Data cleansing completion
    `;
  }

  /**
   * Extract text from Word document
   * @param {string} filePath - Path to Word doc
   * @returns {Promise<string>} Extracted text
   */
  async extractFromWord(filePath) {
    // In production, you'd use libraries like mammoth
    // For now, return mock text
    return this.extractFromPDF(filePath); // Reuse mock data
  }

  /**
   * Send extracted text to AI for structured parsing
   * @param {string} documentText - Raw document text
   * @returns {Promise<Object>} AI response
   */
  async extractWithAI(documentText) {
    try {
      // In production, this would call actual AI service (OpenAI, Claude, etc.)
      // For now, return structured mock response
      
      const prompt = this.buildPrompt(documentText);
      
      // Mock AI response
      return {
        scope: "Comprehensive CRM system implementation including software deployment, data migration, user training, and go-live support",
        deliverables: [
          {
            name: "CRM Software Deployment",
            description: "Deploy and configure CRM software in client environment",
            estimated_effort_days: 15
          },
          {
            name: "Data Migration",
            description: "Migrate existing data to new CRM system",
            estimated_effort_days: 20
          },
          {
            name: "User Training",
            description: "Conduct training sessions for end users",
            estimated_effort_days: 5
          },
          {
            name: "Technical Documentation",
            description: "Create comprehensive technical and user documentation",
            estimated_effort_days: 10
          },
          {
            name: "Go-live Support",
            description: "Provide support during initial go-live period",
            estimated_effort_days: 7
          }
        ],
        risks: [
          {
            type: "timeline",
            description: "Aggressive timeline may impact quality",
            severity: "medium",
            mitigation: "Add buffer time and prioritize critical features"
          },
          {
            type: "technical",
            description: "ERP integration complexity",
            severity: "high",
            mitigation: "Engage specialized integration resources"
          },
          {
            type: "resource",
            description: "Client resource availability during peak periods",
            severity: "medium",
            mitigation: "Schedule key activities during client availability"
          }
        ],
        dependencies: [
          {
            name: "Client Infrastructure",
            description: "Client server and network infrastructure readiness",
            critical: true,
            due_date: "2024-02-15"
          },
          {
            name: "Third-party API Access",
            description: "API credentials and access for ERP system",
            critical: true,
            due_date: "2024-02-20"
          },
          {
            name: "Data Cleansing",
            description: "Complete data quality assessment and cleansing",
            critical: false,
            due_date: "2024-02-25"
          }
        ],
        timeline: {
          total_days: 90,
          phases: [
            {
              name: "Planning",
              duration_days: 10,
              start_day: 1
            },
            {
              name: "Setup",
              duration_days: 15,
              start_day: 11
            },
            {
              name: "Implementation",
              duration_days: 45,
              start_day: 26
            },
            {
              name: "Testing",
              duration_days: 10,
              start_day: 71
            },
            {
              name: "Deployment",
              duration_days: 5,
              start_day: 81
            },
            {
              name: "Training",
              duration_days: 5,
              start_day: 86
            }
          ]
        },
        quality_indicators: {
          has_clear_scope: true,
          has_specific_deliverables: true,
          has_timeline: true,
          has_risk_assessment: true,
          has_dependencies: true,
          completeness_score: 85
        }
      };

    } catch (error) {
      console.error('AI extraction error:', error);
      throw new Error('AI service failed to extract information');
    }
  }

  /**
   * Build prompt for AI extraction
   * @param {string} documentText - Raw document text
   * @returns {string} Formatted prompt
   */
  buildPrompt(documentText) {
    return `
You are an expert project manager analyzing a Statement of Work (SOW) document.

Please extract the following information from the provided SOW text and return it as structured JSON:

1. SCOPE: Overall project scope and objectives
2. DELIVERABLES: List of specific deliverables with descriptions and estimated effort
3. RISKS: Identified risks with type, severity, and mitigation strategies
4. DEPENDENCIES: External dependencies with criticality and due dates
5. TIMELINE: Project timeline including phases and durations

For each section, assess the completeness and quality of information.

SOW Text:
${documentText}

Return response in JSON format with the following structure:
{
  "scope": "string",
  "deliverables": [{"name": "string", "description": "string", "estimated_effort_days": number}],
  "risks": [{"type": "string", "description": "string", "severity": "low|medium|high", "mitigation": "string"}],
  "dependencies": [{"name": "string", "description": "string", "critical": boolean, "due_date": "YYYY-MM-DD"}],
  "timeline": {"total_days": number, "phases": [{"name": "string", "duration_days": number, "start_day": number}]},
  "quality_indicators": {"has_clear_scope": boolean, "has_specific_deliverables": boolean, "has_timeline": boolean, "has_risk_assessment": boolean, "has_dependencies": boolean, "completeness_score": number}
}
    `;
  }

  /**
   * Validate and structure AI response
   * @param {Object} aiResponse - Raw AI response
   * @returns {Object} Validated and structured data
   */
  validateAndStructureResponse(aiResponse) {
    try {
      // Ensure all required fields exist
      const validated = {
        scope: aiResponse.scope || 'Scope not clearly defined',
        deliverables: Array.isArray(aiResponse.deliverables) ? aiResponse.deliverables : [],
        risks: Array.isArray(aiResponse.risks) ? aiResponse.risks : [],
        dependencies: Array.isArray(aiResponse.dependencies) ? aiResponse.dependencies : [],
        timeline: aiResponse.timeline || { total_days: 90, phases: [] }
      };

      // Sanitize deliverables
      validated.deliverables = validated.deliverables.map(deliverable => ({
        name: deliverable.name || 'Unnamed Deliverable',
        description: deliverable.description || 'No description available',
        estimated_effort_days: parseInt(deliverable.estimated_effort_days) || 1
      }));

      // Sanitize risks
      validated.risks = validated.risks.map(risk => ({
        type: risk.type || 'general',
        description: risk.description || 'Risk description not available',
        severity: ['low', 'medium', 'high'].includes(risk.severity) ? risk.severity : 'medium',
        mitigation: risk.mitigation || 'Mitigation plan not specified'
      }));

      // Sanitize dependencies
      validated.dependencies = validated.dependencies.map(dep => ({
        name: dep.name || 'Unnamed Dependency',
        description: dep.description || 'No description available',
        critical: Boolean(dep.critical),
        due_date: dep.due_date || null
      }));

      return validated;

    } catch (error) {
      console.error('Response validation error:', error);
      throw new Error('Failed to validate AI response');
    }
  }

  /**
   * Calculate confidence score for extraction
   * @param {Object} structuredData - Validated structured data
   * @param {string} originalText - Original document text
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidenceScore(structuredData, originalText) {
    let score = 0;
    const maxScore = 100;

    // Check for clear scope (20 points)
    if (structuredData.scope && structuredData.scope.length > 50 && 
        !structuredData.scope.includes('not clearly defined')) {
      score += 20;
    }

    // Check for specific deliverables (25 points)
    if (structuredData.deliverables.length >= 3) {
      score += 15;
      if (structuredData.deliverables.every(d => d.estimated_effort_days > 0)) {
        score += 10;
      }
    }

    // Check for risk assessment (20 points)
    if (structuredData.risks.length >= 2) {
      score += 10;
      if (structuredData.risks.every(r => r.severity && r.mitigation)) {
        score += 10;
      }
    }

    // Check for dependencies (15 points)
    if (structuredData.dependencies.length >= 1) {
      score += 10;
      if (structuredData.dependencies.some(d => d.critical)) {
        score += 5;
      }
    }

    // Check for timeline information (20 points)
    if (structuredData.timeline.total_days > 0) {
      score += 10;
      if (structuredData.timeline.phases.length >= 2) {
        score += 10;
      }
    }

    // Document quality bonus (up to 10 points)
    const wordCount = originalText.split(/\s+/).length;
    if (wordCount > 500) score += 5;
    if (wordCount > 1000) score += 5;

    return Math.min(score, maxScore);
  }

  /**
   * Get fallback extraction when AI fails
   * @param {string} sowDocumentId - Document ID
   * @param {Error} error - Original error
   * @returns {Object} Fallback extraction data
   */
  getFallbackExtraction(sowDocumentId, error) {
    return {
      sow_document_id: sowDocumentId,
      confidence_score: 30, // Low confidence for fallback
      extracted_scope: 'AI processing failed. Manual review required.',
      extracted_deliverables: [
        {
          name: 'Manual Review Required',
          description: 'AI processing failed. Please review SOW document manually.',
          estimated_effort_days: 1
        }
      ],
      extracted_risks: [
        {
          type: 'processing',
          description: 'AI processing failure: ' + error.message,
          severity: 'high',
          mitigation: 'Manual review and data entry required'
        }
      ],
      extracted_dependencies: [],
      extracted_timeline: '90 days',
      raw_response: { error: error.message, fallback: true },
      processing_time_ms: 0
    };
  }

  /**
   * Retry logic for failed extractions
   * @param {string} sowDocumentId - Document ID
   * @param {string} filePath - File path
   * @param {number} attempt - Current attempt number
   * @returns {Promise<Object>} Extraction result
   */
  async parseWithRetry(sowDocumentId, filePath, attempt = 1) {
    const maxAttempts = 3;
    
    try {
      return await this.parseSOW(sowDocumentId, filePath);
    } catch (error) {
      if (attempt < maxAttempts) {
        console.log(`Retrying SOW parsing, attempt ${attempt + 1}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
        return this.parseWithRetry(sowDocumentId, filePath, attempt + 1);
      }
      throw error;
    }
  }
}

module.exports = SOWParsingService;
