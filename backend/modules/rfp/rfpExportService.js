const {
  Document, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Packer, BorderStyle,
} = require('docx');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function divider() {
  return new Paragraph({
    children: [],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2DDD5', space: 6 },
    },
    spacing: { before: 240, after: 0 },
  });
}

function sectionHeading(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 80 },
  });
}

function labeledBlock(label, text) {
  const blocks = [];

  blocks.push(new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, color: '57534E' }),
    ],
    spacing: { before: 160, after: 40 },
  }));

  // Split multi-line content into separate paragraphs
  const lines = (text || '').split('\n');
  lines.forEach((line, i) => {
    blocks.push(new Paragraph({
      children: [new TextRun({ text: line, size: 20, color: '292524' })],
      spacing: { before: i === 0 ? 0 : 40, after: 0 },
      indent: { left: 360 },
    }));
  });

  return blocks;
}

// ─── Main export function ─────────────────────────────────────────────────────

async function generateExportDoc(rfp) {
  const today     = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const sections  = rfp.sections || [];

  const docChildren = [];

  // ── Cover header ────────────────────────────────────────────────────────────
  docChildren.push(
    new Paragraph({
      children: [new TextRun({ text: 'RFP RESPONSE', bold: true, size: 36, color: '4F46E5' })],
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: rfp.title, bold: true, size: 52, color: '1C1917' })],
      spacing: { before: 0, after: 160 },
    }),
  );

  // ── Meta table (client, date, etc.) ─────────────────────────────────────────
  const metaRows = [
    ['Client',      rfp.client_name],
    ['Contact',     rfp.client_contact_name || '-'],
    ['Email',       rfp.client_contact_email || '-'],
    ['Deadline',    rfp.submission_deadline ? new Date(rfp.submission_deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'],
    ['Prepared on', today],
  ];

  metaRows.forEach(([label, value]) => {
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${label}:  `, bold: true, size: 20, color: '57534E' }),
          new TextRun({ text: value, size: 20, color: '1C1917' }),
        ],
        spacing: { before: 60, after: 60 },
      }),
    );
  });

  docChildren.push(divider());

  // ── Sections ─────────────────────────────────────────────────────────────────
  sections.forEach((sec, idx) => {
    docChildren.push(sectionHeading(`${idx + 1}. ${sec.title}`));

    // Customer question (the original RFP requirement)
    if (sec.description) {
      docChildren.push(...labeledBlock('Customer Requirement', sec.description));
    }

    // Response
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Our Response:', bold: true, size: 20, color: '57534E' }),
        ],
        spacing: { before: 200, after: 60 },
      }),
    );

    if (sec.content && sec.content.trim()) {
      const responseLines = sec.content.split('\n');
      responseLines.forEach(line => {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 22, color: '1C1917' })],
            spacing: { before: 40, after: 40 },
            indent: { left: 360 },
          }),
        );
      });
    } else {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: '[No response provided]', italics: true, size: 20, color: 'A8A29E' })],
          spacing: { before: 40, after: 40 },
          indent: { left: 360 },
        }),
      );
    }

    if (idx < sections.length - 1) {
      docChildren.push(divider());
    }
  });

  // ── Footer note ──────────────────────────────────────────────────────────────
  docChildren.push(
    divider(),
    new Paragraph({
      children: [
        new TextRun({ text: `This document was prepared on ${today} and contains ${sections.length} section${sections.length !== 1 ? 's' : ''}.`, size: 18, color: 'A8A29E', italics: true }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 360, after: 0 },
    }),
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
        heading2: {
          run:  { bold: true, size: 28, color: '1C1917', font: 'Calibri' },
          paragraph: { spacing: { before: 320, after: 80 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children: docChildren,
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateExportDoc };
