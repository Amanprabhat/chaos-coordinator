const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./database/connection');
const { setupAuthRoutes } = require('./auth-routes');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');

// Import modular routes
const dashboardRoutes      = require('./modules/dashboard/dashboardRoutes');
const projectsRoutes       = require('./modules/projects/projectsRoutes');
const tasksRoutes          = require('./modules/tasks/tasksRoutes');
const milestonesRoutes     = require('./modules/milestones/milestonesRoutes');
const handoverRoutes       = require('./modules/handover/handoverRoutes');
const notificationsRoutes  = require('./modules/notifications/notificationsRoutes');
const { startNudgeCron }   = require('./modules/notifications/nudgeJob');
const { sendEmail }        = require('./services/emailService');
const path                 = require('path');

// ── Helper: insert a bell notification ────────────────────────────────────────
async function createNotification(db, { user_id, project_id, type, title, message, task_id = null }) {
  try {
    await db('notifications').insert({ user_id, project_id: project_id || null, task_id, type, title, message, is_read: false, email_sent: false });
  } catch (e) { console.error('createNotification error:', e.message); }
}

// ── Helper: get all team members for a project (for discussion notifications) ─
async function getProjectTeam(db, project_id) {
  const project = await db('projects').where({ id: project_id }).first();
  if (!project) return [];
  const ids = [project.csm_id, project.pm_id, project.owner_id].filter(Boolean);
  if (!ids.length) return [];
  return db('users').whereIn('id', ids).where('is_active', true).select('id', 'name', 'email', 'role');
}

// ── Helper: send discussion-message notifications ─────────────────────────────
async function notifyDiscussionMessage(db, { project_id, sender_id, sender_name, sender_role, message_preview, is_private, tagged_user_ids }) {
  try {
    const project = await db('projects').where({ id: project_id }).first();
    if (!project) return;

    let recipients = [];

    if (is_private) {
      // Private: notify only tagged internal users
      if (tagged_user_ids && tagged_user_ids.length) {
        recipients = await db('users').whereIn('id', tagged_user_ids).where('is_active', true).select('id', 'name', 'email', 'role');
      }
    } else {
      // Public: notify all project team members except sender
      const team = await getProjectTeam(db, project_id);
      recipients = team.filter(u => u.id !== sender_id);

      // If sender is internal, also notify client SPOC
      const internalRoles = ['Admin', 'CSM', 'PM', 'Sales'];
      if (internalRoles.includes(sender_role) && project.client_spoc_email) {
        const clientUser = await db('users').where({ email: project.client_spoc_email, is_active: true }).first();
        if (clientUser && clientUser.id !== sender_id) {
          const already = recipients.find(r => r.id === clientUser.id);
          if (!already) recipients.push(clientUser);
        }
      }
    }

    const preview = message_preview.length > 120 ? message_preview.slice(0, 117) + '…' : message_preview;
    const title = `New message in ${project.name || 'project'}`;
    const msgBody = `${sender_name} (${sender_role}): "${preview}"`;

    for (const u of recipients) {
      await createNotification(db, {
        user_id: u.id, project_id, type: 'discussion_message',
        title, message: msgBody,
      });
      // Email
      sendEmail({
        to: u.email,
        subject: `[Chaos Coordinator] ${title}`,
        html: `<p>Hi ${u.name},</p>
               <p><strong>${sender_name}</strong> posted a message in project <strong>${project.name}</strong>:</p>
               <blockquote style="border-left:3px solid #6366f1;padding:8px 16px;color:#374151;">${preview}</blockquote>
               <p>Log in to view and reply.</p>`,
      }).catch(() => {});
    }
  } catch (e) { console.error('notifyDiscussionMessage error:', e.message); }
}

// ── Multer setup for document uploads ───────────────────────────────────────
const DOCS_DIR = path.join(__dirname, 'uploads', 'documents');
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
const docStorage = multer.diskStorage({
  destination: (_, _file, cb) => cb(null, DOCS_DIR),
  filename: (_, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({
  storage: docStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // raised from 100 — dev hot-reload + polling burns through 100 quickly
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (SOW documents etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Chaos Coordinator API',
    version: '2.0.0'
  });
});

// Auth routes (must come before other API routes)
setupAuthRoutes(app);

// Users endpoint — fetch team members by role for intake form
app.get('/api/users', async (req, res) => {
  try {
    const { role } = req.query;
    let query = db('users').select('id', 'name', 'email', 'role', 'department').where('is_active', true);
    if (role) query = query.where('role', role);
    const users = await query.orderBy('name');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/all — all users including inactive (admin management)
app.get('/api/users/all', async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'name', 'email', 'role', 'department', 'is_active', 'created_at')
      .orderBy('name');
    res.json(users);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch users' }); }
});

// POST /api/users — create new user
app.post('/api/users', async (req, res) => {
  try {
    const { name, role, department, password } = req.body;
    const email = (req.body.email || '').toLowerCase().trim();
    if (!name || !email || !role) return res.status(400).json({ error: 'name, email, role are required' });
    const existing = await db('users').whereRaw('LOWER(email) = ?', [email]).first();
    if (existing) return res.status(409).json({ error: 'Email already exists' });
    const defaultPassword = 'password123';
    const password_hash = password ? await bcrypt.hash(password, 10) : await bcrypt.hash(defaultPassword, 10);
    const [id] = await db('users').insert({ name, email, role, department: department || null, password_hash, is_active: true });
    const user = await db('users').select('id', 'name', 'email', 'role', 'department', 'is_active').where({ id }).first();
    res.status(201).json({ ...user, _defaultPassword: password ? undefined : defaultPassword });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to create user' }); }
});

// PUT /api/users/:id — update user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, email, role, department, is_active, password } = req.body;
    const updates = {};
    if (name !== undefined)       updates.name       = name;
    if (email !== undefined)      updates.email      = email;
    if (role !== undefined)       updates.role       = role;
    if (department !== undefined) updates.department = department;
    if (is_active !== undefined)  updates.is_active  = is_active;
    if (password)                 updates.password_hash = await bcrypt.hash(password, 10);
    updates.updated_at = new Date().toISOString();
    await db('users').where({ id: req.params.id }).update(updates);
    const user = await db('users').select('id', 'name', 'email', 'role', 'department', 'is_active').where({ id: req.params.id }).first();
    res.json(user);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to update user' }); }
});

// DELETE /api/users/:id — soft-delete (deactivate)
app.delete('/api/users/:id', async (req, res) => {
  try {
    await db('users').where({ id: req.params.id }).update({ is_active: false });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to deactivate user' }); }
});

// ── Discussion / Documents routes ────────────────────────────────────────────

// GET /api/projects/:id/discussions — messages + documents combined
// Pass ?viewer_role=Client to strip private messages
app.get('/api/projects/:id/discussions', async (req, res) => {
  try {
    const pid = parseInt(req.params.id);
    const viewerRole = req.query.viewer_role || '';
    const isClient = viewerRole === 'Client';
    const [messages, docs] = await Promise.all([
      db('project_discussions').where({ project_id: pid }).orderBy('created_at', 'asc'),
      db('project_documents').where({ project_id: pid }).orderBy('created_at', 'desc'),
    ]);
    const filtered = isClient ? messages.filter(m => !m.is_private) : messages;
    res.json({ messages: filtered, documents: docs });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch discussions' }); }
});

// POST /api/projects/:id/discussions — post a message
app.post('/api/projects/:id/discussions', async (req, res) => {
  try {
    const pid = parseInt(req.params.id);
    const { user_id, user_name, user_role, message, is_private, tagged_users } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

    const taggedArr = Array.isArray(tagged_users) ? tagged_users : [];

    const [id] = await db('project_discussions').insert({
      project_id: pid,
      user_id: user_id || null,
      user_name: user_name || 'Unknown',
      user_role: user_role || 'Unknown',
      message: message.trim(),
      is_private: is_private ? 1 : 0,
      tagged_users: taggedArr.length ? JSON.stringify(taggedArr) : null,
    });
    const row = await db('project_discussions').where({ id }).first();

    // Fire-and-forget notifications (don't block the response)
    notifyDiscussionMessage(db, {
      project_id: pid,
      sender_id: user_id || null,
      sender_name: user_name || 'Unknown',
      sender_role: user_role || 'Unknown',
      message_preview: message.trim(),
      is_private: !!is_private,
      tagged_user_ids: taggedArr,
    }).catch(() => {});

    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: 'Failed to post message' }); }
});

// DELETE /api/projects/:projectId/discussions/:msgId — delete a message
app.delete('/api/projects/:projectId/discussions/:msgId', async (req, res) => {
  try {
    await db('project_discussions').where({ id: req.params.msgId, project_id: req.params.projectId }).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete message' }); }
});

// POST /api/projects/:id/documents — upload a document
app.post('/api/projects/:id/documents', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const pid = parseInt(req.params.id);
    const { user_id, user_name, user_role, category, description } = req.body;
    const [id] = await db('project_documents').insert({
      project_id: pid, user_id: user_id || null,
      user_name: user_name || 'Unknown', user_role: user_role || 'Unknown',
      original_filename: req.file.originalname,
      stored_filename: req.file.filename,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      category: category || 'General',
      description: description || null,
    });
    const row = await db('project_documents').where({ id }).first();
    res.status(201).json(row);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to upload document' }); }
});

// GET /api/projects/:projectId/documents/:docId/download — download file
app.get('/api/projects/:projectId/documents/:docId/download', async (req, res) => {
  try {
    const doc = await db('project_documents').where({ id: req.params.docId, project_id: req.params.projectId }).first();
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const filePath = path.join(DOCS_DIR, doc.stored_filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
    res.download(filePath, doc.original_filename);
  } catch (e) { res.status(500).json({ error: 'Failed to download document' }); }
});

// DELETE /api/projects/:projectId/documents/:docId — delete document
app.delete('/api/projects/:projectId/documents/:docId', async (req, res) => {
  try {
    const doc = await db('project_documents').where({ id: req.params.docId, project_id: req.params.projectId }).first();
    if (doc) {
      const filePath = path.join(DOCS_DIR, doc.stored_filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await db('project_documents').where({ id: req.params.docId }).delete();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete document' }); }
});

// Serve document files
app.use('/uploads/documents', express.static(DOCS_DIR));

// ── Client Requests (CR / New Requirements) ──────────────────────────────────

// GET /api/projects/:id/client-requests
app.get('/api/projects/:id/client-requests', async (req, res) => {
  try {
    const pid = parseInt(req.params.id);
    const rows = await db('client_requests').where({ project_id: pid }).orderBy('created_at', 'desc');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch client requests' }); }
});

// POST /api/projects/:id/client-requests — client raises a request
app.post('/api/projects/:id/client-requests', async (req, res) => {
  try {
    const pid = parseInt(req.params.id);
    const { client_user_id, client_name, client_email, request_type, title, description, priority } = req.body;
    if (!title?.trim() || !description?.trim()) return res.status(400).json({ error: 'title and description are required' });

    const [id] = await db('client_requests').insert({
      project_id: pid,
      client_user_id: client_user_id || null,
      client_name: client_name || 'Client',
      client_email: client_email || '',
      request_type: request_type || 'new_requirement',
      title: title.trim(),
      description: description.trim(),
      priority: priority || 'Medium',
      status: 'pending',
    });
    const row = await db('client_requests').where({ id }).first();

    // Notify project team + admins
    const project = await db('projects').where({ id: pid }).first();
    const team = await getProjectTeam(db, pid);
    const admins = await db('users').where({ role: 'Admin', is_active: true }).select('id', 'name', 'email');
    const allRecipients = [...team, ...admins.filter(a => !team.find(t => t.id === a.id))];

    const notifTitle = `New ${request_type === 'change_request' ? 'CR' : 'request'}: ${title.slice(0, 60)}`;
    const notifMsg = `${client_name} raised a ${request_type?.replace(/_/g, ' ')} on project "${project?.name}": ${description.slice(0, 100)}`;

    for (const u of allRecipients) {
      await createNotification(db, { user_id: u.id, project_id: pid, type: 'client_request_raised', title: notifTitle, message: notifMsg });
      sendEmail({
        to: u.email,
        subject: `[Chaos Coordinator] ${notifTitle}`,
        html: `<p>Hi ${u.name},</p>
               <p><strong>${client_name}</strong> has raised a new request on project <strong>${project?.name}</strong>.</p>
               <p><strong>Type:</strong> ${request_type?.replace(/_/g, ' ')}</p>
               <p><strong>Title:</strong> ${title}</p>
               <blockquote style="border-left:3px solid #8b5cf6;padding:8px 16px;color:#374151;">${description}</blockquote>
               <p>Please log in to review and respond.</p>`,
      }).catch(() => {});
    }

    // Check if same title/type was raised by another client on a DIFFERENT project — notify admins
    const similar = await db('client_requests')
      .whereNot({ id })
      .where({ request_type })
      .whereRaw('LOWER(title) = LOWER(?)', [title.trim()])
      .count('* as cnt')
      .first();
    if (Number(similar?.cnt) >= 1) {
      for (const admin of admins) {
        await createNotification(db, {
          user_id: admin.id, project_id: pid, type: 'duplicate_client_request',
          title: 'Multiple clients raised the same request',
          message: `"${title}" has been raised by ${Number(similar.cnt) + 1} clients across projects. Consider a platform-wide solution.`,
        });
      }
    }

    res.status(201).json(row);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to create client request' }); }
});

// PUT /api/projects/:id/client-requests/:reqId — approve / reject / close
app.put('/api/projects/:id/client-requests/:reqId', async (req, res) => {
  try {
    const { status, response_comments, responded_by, mom_document_id } = req.body;
    const now = new Date().toISOString();
    const updates = { updated_at: now };

    if (status) updates.status = status;
    if (response_comments !== undefined) updates.response_comments = response_comments;
    if (responded_by) { updates.responded_by = responded_by; updates.responded_at = now; }
    if (status === 'approved') {
      updates.approved_at = now;
      // 3-day deadline for CSM to close
      const due = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      updates.due_date = due;
    }
    if (status === 'closed') updates.closed_at = now;
    if (mom_document_id) updates.mom_document_id = mom_document_id;

    await db('client_requests').where({ id: req.params.reqId, project_id: req.params.id }).update(updates);
    const row = await db('client_requests').where({ id: req.params.reqId }).first();

    // Notify client of decision
    if (row && (status === 'approved' || status === 'rejected') && row.client_email) {
      const project = await db('projects').where({ id: req.params.id }).first();
      sendEmail({
        to: row.client_email,
        subject: `[Chaos Coordinator] Your request "${row.title}" has been ${status}`,
        html: `<p>Hi ${row.client_name},</p>
               <p>Your request <strong>"${row.title}"</strong> on project <strong>${project?.name}</strong> has been <strong>${status}</strong>.</p>
               ${response_comments ? `<p><strong>Comments:</strong> ${response_comments}</p>` : ''}
               ${status === 'approved' ? '<p>Our team will reach out within 3 business days to discuss next steps.</p>' : ''}`,
      }).catch(() => {});

      // If approved, notify CSM + PM about 3-day deadline
      if (status === 'approved') {
        const team = await getProjectTeam(db, parseInt(req.params.id));
        for (const u of team.filter(m => ['CSM', 'PM'].includes(m.role))) {
          await createNotification(db, {
            user_id: u.id, project_id: parseInt(req.params.id), type: 'cr_approved_deadline',
            title: `CR approved — 3-day closure deadline: "${row.title}"`,
            message: `You have 3 days to discuss with ${row.client_name} and upload the MoM. CSM is primary owner.`,
          });
          sendEmail({
            to: u.email,
            subject: `[Chaos Coordinator] Action required: CR "${row.title}" approved — 3-day deadline`,
            html: `<p>Hi ${u.name},</p>
                   <p>The client request <strong>"${row.title}"</strong> has been approved.</p>
                   <p>As <strong>${u.role === 'CSM' ? 'primary owner (CSM)' : 'PM'}</strong>, you must:</p>
                   <ol><li>Schedule a meeting with the client within 3 days</li>
                   <li>Upload the MoM to the project documents</li></ol>
                   <p><strong>Deadline: ${new Date(updates.due_date).toLocaleDateString()}</strong></p>`,
          }).catch(() => {});
        }
      }
    }

    res.json(row);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to update request' }); }
});

// GET /api/client-requests/all — admin sees all requests across all projects
app.get('/api/client-requests/all', async (_req, res) => {
  try {
    const rows = await db('client_requests as cr')
      .join('projects as p', 'cr.project_id', 'p.id')
      .select('cr.*', 'p.name as project_name', 'p.client_name as project_client')
      .orderBy('cr.created_at', 'desc');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch all client requests' }); }
});

// PUT /api/users/:id/assign-projects — sync which projects a Client user can access
// Sets client_spoc_email + client_spoc_name on selected projects, clears from unselected
app.put('/api/users/:id/assign-projects', async (req, res) => {
  try {
    const { project_ids = [], email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    // Remove this client from any projects NOT in the new list
    await db('projects')
      .whereRaw('LOWER(client_spoc_email) = LOWER(?)', [email])
      .modify(q => {
        if (project_ids.length) q.whereNotIn('id', project_ids);
      })
      .update({ client_spoc_email: null, client_spoc_name: null });

    // Assign to the selected projects
    if (project_ids.length) {
      await db('projects')
        .whereIn('id', project_ids)
        .update({ client_spoc_email: email, client_spoc_name: name });
    }

    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to assign projects' }); }
});

// ── SharePoint Chatbot Search ─────────────────────────────────────────────────
// POST /api/chatbot/search  { query: string }
// Returns a list of matching documents from the configured SharePoint site.
// Requires SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET,
// SHAREPOINT_HOSTNAME, SHAREPOINT_SITE_PATH in .env

let _spTokenCache = null; // { access_token, expires_at }

async function getSharePointToken() {
  if (_spTokenCache && Date.now() < _spTokenCache.expires_at) return _spTokenCache.access_token;

  const tenantId = process.env.SHAREPOINT_TENANT_ID;
  const clientId = process.env.SHAREPOINT_CLIENT_ID;
  const clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) throw new Error('SharePoint credentials not configured');

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });

  const res = await fetch(tokenUrl, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || 'Failed to get token');

  _spTokenCache = { access_token: data.access_token, expires_at: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

app.post('/api/chatbot/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) return res.status(400).json({ error: 'query is required' });

    const token = await getSharePointToken();

    // Use Graph Search API scoped to driveItems (files in SharePoint)
    const hostname = process.env.SHAREPOINT_HOSTNAME || 'knowledgemax.sharepoint.com';
    const sitePath = process.env.SHAREPOINT_SITE_PATH || '/sites/TechnicalDocumentationCenter';

    // First resolve the site ID to scope the search
    const siteRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!siteRes.ok) throw new Error('Could not resolve SharePoint site');

    // Search within the site drives
    const searchRes = await fetch('https://graph.microsoft.com/v1.0/search/query', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          entityTypes: ['driveItem'],
          query: { queryString: `${query.trim()} site:${hostname}${sitePath}` },
          from: 0,
          size: 8,
          fields: ['name', 'webUrl', 'parentReference', 'lastModifiedDateTime', 'size', 'file'],
        }],
      }),
    });

    const searchData = await searchRes.json();
    const hits = searchData?.value?.[0]?.hitsContainers?.[0]?.hits || [];

    const results = hits.map((hit) => {
      const r = hit.resource;
      const webUrl = r.webUrl || '';
      // Build a readable folder path
      const parentPath = r.parentReference?.path?.replace('/drive/root:', '') || '/';
      return {
        name: r.name || 'Unknown',
        webUrl,
        folderPath: parentPath,
        lastModified: r.lastModifiedDateTime || null,
        summary: hit.summary || null,
      };
    });

    res.json({ results, total: results.length, query: query.trim() });
  } catch (e) {
    console.error('Chatbot search error:', e.message);
    // Return a graceful response so the widget can show a helpful message
    res.status(200).json({ results: [], total: 0, error: e.message, query: req.body?.query || '' });
  }
});

// GET /api/projects/:id/team-members — for @mention autocomplete in discussions
app.get('/api/projects/:id/team-members', async (req, res) => {
  try {
    const project = await db('projects').where({ id: req.params.id }).first();
    if (!project) return res.json([]);
    const ids = [project.csm_id, project.pm_id, project.owner_id].filter(Boolean);
    const members = ids.length ? await db('users').whereIn('id', ids).where('is_active', true).select('id', 'name', 'role') : [];
    res.json(members);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch team members' }); }
});

// API Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/milestones', milestonesRoutes);
app.use('/api/handover', handoverRoutes);
app.use('/api/notifications', notificationsRoutes);

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Chaos Coordinator API v2.0.0',
    version: '2.0.0',
    endpoints: {
      dashboard: {
        overview: 'GET /api/dashboard/overview',
        issues: 'GET /api/dashboard/issues',
        my_work: 'GET /api/dashboard/my-work?user_id=:id',
        activity: 'GET /api/dashboard/activity?limit=:limit',
        performance: 'GET /api/dashboard/performance?period=:days'
      },
      projects: {
        list: 'GET /api/projects',
        details: 'GET /api/projects/:id',
        create: 'POST /api/projects',
        update: 'PUT /api/projects/:id',
        delete: 'DELETE /api/projects/:id',
        transition_stage: 'POST /api/projects/:id/transition-stage',
        check_transition: 'GET /api/projects/:id/can-transition'
      },
      tasks: {
        list: 'GET /api/tasks',
        details: 'GET /api/tasks/:id',
        create: 'POST /api/tasks',
        update: 'PUT /api/tasks/:id',
        delete: 'DELETE /api/tasks/:id',
        batch_create: 'POST /api/tasks/batch',
        orphaned: 'GET /api/tasks/orphaned',
        overdue: 'GET /api/tasks/overdue',
        assign: 'POST /api/tasks/:id/assign'
      },
      milestones: {
        list: 'GET /api/milestones',
        details: 'GET /api/milestones/:id',
        create: 'POST /api/milestones',
        update: 'PUT /api/milestones/:id',
        delete: 'DELETE /api/milestones/:id',
        project_milestones: 'GET /api/milestones/project/:projectId',
        blocked: 'GET /api/milestones/blocked',
        overdue: 'GET /api/milestones/overdue',
        complete: 'POST /api/milestones/:id/complete'
      },
      handover: {
        list: 'GET /api/handover',
        details: 'GET /api/handover/:id',
        create: 'POST /api/handover',
        update: 'PUT /api/handover/:id',
        approve: 'POST /api/handover/:id/approve',
        project_handovers: 'GET /api/handover/project/:projectId',
        pending: 'GET /api/handover/pending',
        checklist: 'GET /api/handover/checklist/:projectId/:fromRole/:toRole'
      }
    },
    features: {
      ownership_validation: 'Mandatory owner_id for all tasks, milestones, projects, and risks',
      lifecycle_engine: 'Automated stage transitions with validation rules',
      dashboard_analytics: 'Real-time metrics and issue tracking',
      handover_management: 'Structured handover process with approval workflow'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.message,
      details: error.details || []
    });
  }
  
  if (error.code === '23505') { // Unique violation
    return res.status(409).json({
      error: 'Conflict',
      message: 'Resource already exists'
    });
  }
  
  if (error.code === '23503') { // Foreign key violation
    return res.status(400).json({
      error: 'Reference Error',
      message: 'Referenced resource does not exist'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Database connection test
async function testDatabaseConnection() {
  try {
    await db.raw('SELECT 1');
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await db.destroy();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await db.destroy();
  process.exit(0);
});

// Start server
async function startServer() {
  await testDatabaseConnection();
  startNudgeCron();
  
  app.listen(PORT, () => {
    console.log(`🚀 Chaos Coordinator API Server running on port ${PORT}`);
    console.log(`📊 API Documentation: http://localhost:${PORT}/api`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer().catch(console.error);
}

module.exports = app;
