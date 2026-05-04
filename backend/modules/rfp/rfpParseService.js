const Anthropic = require('@anthropic-ai/sdk');
const pdfParse  = require('pdf-parse');
const mammoth   = require('mammoth');
const XLSX      = require('xlsx');

// ─── Text extraction ──────────────────────────────────────────────────────────

async function extractText(buffer, mimetype, originalname) {
  const ext = (originalname || '').split('.').pop().toLowerCase();

  if (mimetype === 'application/pdf' || ext === 'pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword' ||
    ext === 'docx' || ext === 'doc'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (
    ext === 'xlsx' || ext === 'xls' ||
    mimetype.includes('spreadsheet') || mimetype.includes('excel')
  ) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let text = '';
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      text += `\n=== Sheet: ${sheetName} ===\n`;
      text += XLSX.utils.sheet_to_csv(sheet);
    });
    return text;
  }

  throw new Error(`Unsupported file format: .${ext}. Supported formats: PDF, Word (.docx/.doc), Excel (.xlsx/.xls)`);
}

// ─── Claude AI parsing ────────────────────────────────────────────────────────

async function parseWithClaude(rfpText) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-anthropic-api-key-here') {
    throw new Error('ANTHROPIC_API_KEY is not configured. Please add it to your .env file.');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are analyzing an RFP (Request for Proposal) document. Extract every section, requirement, and question that a vendor needs to respond to.

For each item found, return a JSON array with this exact structure:
[
  {
    "customer_section_title": "Exact heading from the RFP (e.g., '3.2 Technical Architecture')",
    "customer_question": "Full requirement or question text the vendor must respond to. Be complete - include all sub-points.",
    "internal_type": "one of the types below",
    "order": 1
  }
]

Map internal_type using these rules:
- "executive_summary"   : executive overview, summary of proposal, cover letter
- "company_overview"    : company background, credentials, experience, team bios, references
- "technical_solution"  : technical approach, architecture, methodology, solution design, technology stack
- "implementation_plan" : project plan, timeline, milestones, deployment, go-live, onboarding
- "commercial"          : pricing, costs, payment terms, commercial terms, fee schedule
- "support_maintenance" : support model, SLAs, helpdesk, maintenance, training
- "compliance"          : certifications, security, legal, regulatory, GDPR, data protection, ISO
- "custom"              : anything else

RFP DOCUMENT:
---
${rfpText.slice(0, 60000)}
---

Rules:
- Return ONLY a valid JSON array, no markdown fences, no other text
- Every requirement that needs a response must become its own section
- If the document has numbered sections, preserve the numbering in customer_section_title
- Minimum 1 section, maximum 40 sections
- order starts at 1`;

  const message = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text.trim();

  // Strip markdown code fences if Claude wrapped it
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let sections;
  try {
    sections = JSON.parse(cleaned);
  } catch {
    // Try to find JSON array in the response
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Claude did not return a valid JSON array. Try again or check document format.');
    sections = JSON.parse(match[0]);
  }

  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('No sections could be extracted from the document.');
  }

  return sections;
}

module.exports = { extractText, parseWithClaude };
