const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const db       = require('../../database/connection');
const { extractText, parseWithClaude } = require('./rfpParseService');
const { generateExportDoc }            = require('./rfpExportService');

// multer: memory storage, 20 MB limit, accept PDF/Word/Excel only
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    const ext = (file.originalname || '').split('.').pop().toLowerCase();
    if (allowed.includes(file.mimetype) || ['pdf','docx','doc','xlsx','xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Word, and Excel files are supported.'));
    }
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sectionCompletion(sections) {
  if (!sections.length) return 0;
  const done = sections.filter(s => s.status === 'done').length;
  return Math.round((done / sections.length) * 100);
}

// ─── GET /api/rfp ─────────────────────────────────────────────────────────────
// List RFPs. Sales sees own; Admin sees all; CSM/PM see RFPs they have sections in.
router.get('/', async (req, res) => {
  try {
    const { user_id, role, status } = req.query;

    let rfps;

    if (role === 'Admin') {
      rfps = await db('rfps')
        .leftJoin('users as owner', 'rfps.owner_id', 'owner.id')
        .select('rfps.*', 'owner.name as owner_name')
        .modify(q => { if (status) q.where('rfps.status', status); })
        .orderBy('rfps.created_at', 'desc');

    } else if (role === 'Sales') {
      rfps = await db('rfps')
        .leftJoin('users as owner', 'rfps.owner_id', 'owner.id')
        .select('rfps.*', 'owner.name as owner_name')
        .where('rfps.owner_id', user_id)
        .modify(q => { if (status) q.where('rfps.status', status); })
        .orderBy('rfps.created_at', 'desc');

    } else {
      // CSM / PM / others - see RFPs where they have an assigned section
      if (!user_id) { return res.json([]); }
      const assignedRfpIds = await db('rfp_sections')
        .where('assigned_to_id', user_id)
        .distinct('rfp_id')
        .pluck('rfp_id');

      rfps = await db('rfps')
        .leftJoin('users as owner', 'rfps.owner_id', 'owner.id')
        .select('rfps.*', 'owner.name as owner_name')
        .whereIn('rfps.id', assignedRfpIds)
        .modify(q => { if (status) q.where('rfps.status', status); })
        .orderBy('rfps.created_at', 'desc');
    }

    // Attach section counts and completion
    const rfpIds = rfps.map(r => r.id);
    const sections = rfpIds.length
      ? await db('rfp_sections').whereIn('rfp_id', rfpIds).select('rfp_id', 'status')
      : [];

    const sectionMap = {};
    sections.forEach(s => {
      if (!sectionMap[s.rfp_id]) sectionMap[s.rfp_id] = [];
      sectionMap[s.rfp_id].push(s);
    });

    const result = rfps.map(r => ({
      ...r,
      section_count:      (sectionMap[r.id] || []).length,
      completion_percent: sectionCompletion(sectionMap[r.id] || []),
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /api/rfp error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/rfp/stats ───────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const { user_id, role } = req.query;

    let baseQuery = db('rfps');
    if (role !== 'Admin') baseQuery = baseQuery.where('owner_id', user_id);

    const all    = await baseQuery.clone().count('id as count').first();
    const won    = await baseQuery.clone().where('status', 'won').count('id as count').first();
    const lost   = await baseQuery.clone().where('status', 'lost').count('id as count').first();

    const total     = parseInt(all.count)  || 0;
    const wonCount  = parseInt(won.count)  || 0;
    const lostCount = parseInt(lost.count) || 0;
    const decided   = wonCount + lostCount;
    const winRate   = decided > 0 ? Math.round((wonCount / decided) * 100) : null;

    // Pipeline value: sum of estimated_value for non-lost/non-won
    const pipelineRow = await baseQuery.clone()
      .whereNotIn('status', ['won', 'lost'])
      .sum('estimated_value as total')
      .first();

    // Deadlines this week
    const today    = new Date();
    const weekEnd  = new Date(today); weekEnd.setDate(today.getDate() + 7);
    const deadlineThisWeek = await baseQuery.clone()
      .whereBetween('submission_deadline', [
        today.toISOString().slice(0, 10),
        weekEnd.toISOString().slice(0, 10),
      ])
      .whereNotIn('status', ['won', 'lost', 'submitted'])
      .count('id as count')
      .first();

    res.json({
      total,
      won:                wonCount,
      lost:               lostCount,
      win_rate:           winRate,
      pipeline_value:     parseFloat(pipelineRow?.total) || 0,
      deadline_this_week: parseInt(deadlineThisWeek?.count) || 0,
    });
  } catch (err) {
    console.error('GET /api/rfp/stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/rfp/library ─────────────────────────────────────────────────────
router.get('/library', async (req, res) => {
  try {
    const { section_type, search } = req.query;
    let q = db('rfp_content_library')
      .leftJoin('users', 'rfp_content_library.created_by', 'users.id')
      .select('rfp_content_library.*', 'users.name as created_by_name')
      .orderBy('rfp_content_library.used_count', 'desc');

    if (section_type) q = q.where('rfp_content_library.section_type', section_type);
    if (search)       q = q.where(b => b
      .whereILike('rfp_content_library.title', `%${search}%`)
      .orWhereILike('rfp_content_library.tags',  `%${search}%`)
    );

    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/rfp/library ────────────────────────────────────────────────────
router.post('/library', async (req, res) => {
  try {
    const { title, section_type, content, tags, created_by } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content required' });
    const [id] = await db('rfp_content_library').insert({ title, section_type, content, tags, created_by });
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/rfp/library/:id ─────────────────────────────────────────────────
router.put('/library/:id', async (req, res) => {
  try {
    const { title, section_type, content, tags } = req.body;
    await db('rfp_content_library').where({ id: req.params.id }).update({ title, section_type, content, tags, updated_at: db.fn.now() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/rfp/library/:id ──────────────────────────────────────────────
router.delete('/library/:id', async (req, res) => {
  try {
    await db('rfp_content_library').where({ id: req.params.id }).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/rfp ────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      title, client_name, client_contact_name, client_contact_email,
      client_contact_phone, estimated_value, currency, submission_deadline,
      decision_expected_date, description, priority, rfp_source, owner_id,
    } = req.body;

    if (!title || !client_name || !owner_id) {
      return res.status(400).json({ error: 'title, client_name and owner_id are required' });
    }

    const [id] = await db('rfps').insert({
      title, client_name, client_contact_name, client_contact_email,
      client_contact_phone, estimated_value: estimated_value || null,
      currency: currency || 'USD', submission_deadline: submission_deadline || null,
      decision_expected_date: decision_expected_date || null,
      description, priority: priority || 'medium',
      rfp_source, owner_id, status: 'draft',
    });

    res.status(201).json({ id });
  } catch (err) {
    console.error('POST /api/rfp error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/rfp/:id ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const rfp = await db('rfps')
      .leftJoin('users as owner', 'rfps.owner_id', 'owner.id')
      .leftJoin('projects', 'rfps.linked_project_id', 'projects.id')
      .select(
        'rfps.*',
        'owner.name as owner_name',
        'owner.email as owner_email',
        'projects.name as linked_project_name',
      )
      .where('rfps.id', req.params.id)
      .first();

    if (!rfp) return res.status(404).json({ error: 'RFP not found' });

    const sections = await db('rfp_sections')
      .leftJoin('users as assignee', 'rfp_sections.assigned_to_id', 'assignee.id')
      .select('rfp_sections.*', 'assignee.name as assignee_name', 'assignee.role as assignee_role')
      .where('rfp_sections.rfp_id', req.params.id)
      .orderBy('rfp_sections.order_index');

    const comments = await db('rfp_comments')
      .leftJoin('users', 'rfp_comments.user_id', 'users.id')
      .select('rfp_comments.*', 'users.name as user_name', 'users.role as user_role')
      .where('rfp_comments.rfp_id', req.params.id)
      .orderBy('rfp_comments.created_at', 'asc');

    res.json({ ...rfp, sections, comments, completion_percent: sectionCompletion(sections) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/rfp/:id ─────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const allowed = [
      'title','client_name','client_contact_name','client_contact_email',
      'client_contact_phone','estimated_value','currency','submission_deadline',
      'decision_expected_date','description','priority','rfp_source',
      'status','submission_notes','outcome_notes',
    ];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updated_at = db.fn.now();

    await db('rfps').where({ id: req.params.id }).update(updates);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/rfp/:id ──────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const rfp = await db('rfps').where({ id: req.params.id }).first();
    if (!rfp) return res.status(404).json({ error: 'RFP not found' });
    if (rfp.status !== 'draft') return res.status(400).json({ error: 'Only draft RFPs can be deleted' });
    await db('rfps').where({ id: req.params.id }).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/rfp/:id/sections ───────────────────────────────────────────────
router.post('/:id/sections', async (req, res) => {
  try {
    const { title, description, section_type, assigned_to_id, word_limit, due_date, order_index } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const maxOrder = await db('rfp_sections').where({ rfp_id: req.params.id }).max('order_index as m').first();
    const nextOrder = order_index ?? ((maxOrder?.m ?? -1) + 1);

    const [id] = await db('rfp_sections').insert({
      rfp_id: req.params.id, title, description, section_type: section_type || 'custom',
      assigned_to_id: assigned_to_id || null, word_limit: word_limit || null,
      due_date: due_date || null, order_index: nextOrder, status: 'not_started',
    });

    // Auto-advance RFP to in_progress when first section added
    const rfp = await db('rfps').where({ id: req.params.id }).first();
    if (rfp && rfp.status === 'draft') {
      await db('rfps').where({ id: req.params.id }).update({ status: 'in_progress', updated_at: db.fn.now() });
    }

    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/rfp/:id/sections/:sId ──────────────────────────────────────────
router.put('/:id/sections/:sId', async (req, res) => {
  try {
    const allowed = ['title','description','section_type','assigned_to_id','status','content','word_limit','due_date','order_index','saved_to_library'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updated_at = db.fn.now();

    await db('rfp_sections').where({ id: req.params.sId, rfp_id: req.params.id }).update(updates);

    // If all sections done, set RFP to under_review automatically
    if (updates.status === 'done') {
      const sections = await db('rfp_sections').where({ rfp_id: req.params.id });
      const allDone = sections.every(s => s.status === 'done');
      if (allDone) {
        await db('rfps').where({ id: req.params.id }).update({ status: 'under_review', updated_at: db.fn.now() });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/rfp/:id/sections/:sId ───────────────────────────────────────
router.delete('/:id/sections/:sId', async (req, res) => {
  try {
    await db('rfp_sections').where({ id: req.params.sId, rfp_id: req.params.id }).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/rfp/:id/comments ───────────────────────────────────────────────
router.post('/:id/comments', async (req, res) => {
  try {
    const { user_id, section_id, message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const [id] = await db('rfp_comments').insert({ rfp_id: req.params.id, section_id: section_id || null, user_id, message });
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/rfp/:id/won ────────────────────────────────────────────────────
router.post('/:id/won', async (req, res) => {
  try {
    const { outcome_notes } = req.body;
    await db('rfps').where({ id: req.params.id }).update({ status: 'won', outcome_notes: outcome_notes || null, updated_at: db.fn.now() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/rfp/:id/lost ───────────────────────────────────────────────────
router.post('/:id/lost', async (req, res) => {
  try {
    const { outcome_notes } = req.body;
    await db('rfps').where({ id: req.params.id }).update({ status: 'lost', outcome_notes: outcome_notes || null, updated_at: db.fn.now() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/rfp/library/:libId/use ─────────────────────────────────────────
// Increments used_count when a library item is pulled into a section
router.post('/library/:libId/use', async (req, res) => {
  try {
    await db('rfp_content_library').where({ id: req.params.libId }).increment('used_count', 1);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/rfp/:id/parse ──────────────────────────────────────────────────
// Upload RFP document, extract text, call Claude, create sections
router.post('/:id/parse', upload.single('file'), async (req, res) => {
  try {
    const rfp = await db('rfps').where({ id: req.params.id }).first();
    if (!rfp) return res.status(404).json({ error: 'RFP not found' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Step 1: extract text from document
    let rawText;
    try {
      rawText = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
    } catch (e) {
      return res.status(422).json({ error: `Could not read document: ${e.message}` });
    }

    if (!rawText || rawText.trim().length < 50) {
      return res.status(422).json({ error: 'Document appears to be empty or unreadable.' });
    }

    // Step 2: parse with Claude
    let parsed;
    try {
      parsed = await parseWithClaude(rawText);
    } catch (e) {
      return res.status(502).json({ error: `AI parsing failed: ${e.message}` });
    }

    // Step 3: delete existing sections (if re-parsing)
    await db('rfp_sections').where({ rfp_id: req.params.id }).delete();

    // Step 4: insert new sections
    const rows = parsed.map((s, i) => ({
      rfp_id:       req.params.id,
      title:        s.customer_section_title || `Section ${i + 1}`,
      description:  s.customer_question     || null,
      section_type: s.internal_type         || 'custom',
      order_index:  s.order                 ?? (i + 1),
      status:       'not_started',
    }));

    await db('rfp_sections').insert(rows);

    // Step 5: advance RFP to in_progress
    if (rfp.status === 'draft') {
      await db('rfps').where({ id: req.params.id }).update({ status: 'in_progress', updated_at: db.fn.now() });
    }

    res.json({ sections_created: rows.length });
  } catch (err) {
    console.error('POST /api/rfp/:id/parse error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/rfp/:id/export ──────────────────────────────────────────────────
// Generate and download a .docx response document
router.get('/:id/export', async (req, res) => {
  try {
    const rfp = await db('rfps').where({ id: req.params.id }).first();
    if (!rfp) return res.status(404).json({ error: 'RFP not found' });

    const sections = await db('rfp_sections')
      .where({ rfp_id: req.params.id })
      .orderBy('order_index');

    const docBuffer = await generateExportDoc({ ...rfp, sections });

    const filename = `RFP_Response_${rfp.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(docBuffer);
  } catch (err) {
    console.error('GET /api/rfp/:id/export error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
