/**
 * Nudge Job
 *
 * Runs every hour. Finds tasks that are overdue and nudges:
 *   ≥ 24h overdue  → notify assignee (in-app + email)
 *   ≥ 48h overdue  → notify assignee's manager too (email CC)
 *
 * A nudge is only sent once per window (tracked in nudge_log).
 * "Manager" = first Admin user in the system (configurable via MANAGER_USER_ID env).
 */
const cron = require('node-cron');
const db = require('../../database/connection');
const { sendEmail } = require('../../services/emailService');

const HOUR_MS = 60 * 60 * 1000;

/**
 * Create an in-app notification record.
 */
async function createNotification({ user_id, project_id, task_id, type, title, message }) {
  try {
    await db('notifications').insert({
      user_id,
      project_id: project_id || null,
      task_id:    task_id    || null,
      type,
      title,
      message,
      is_read:    false,
      email_sent: false,
      created_at: new Date(),
      updated_at: new Date(),
    });
  } catch (err) {
    console.error('nudgeJob: failed to create notification', err.message);
  }
}

/**
 * Mark email as sent for a notification belonging to a task+user+type combo.
 * We also log into nudge_log to prevent re-sending.
 */
async function logNudgeSent(task_id, user_id, nudge_type) {
  try {
    await db('nudge_log').insert({ task_id, user_id, nudge_type, sent_at: new Date() });
  } catch (_) { /* ignore duplicate log failures */ }
}

/**
 * Check whether a nudge of this type was already sent for this task+user.
 */
async function nudgeAlreadySent(task_id, user_id, nudge_type) {
  const row = await db('nudge_log').where({ task_id, user_id, nudge_type }).first();
  return !!row;
}

/**
 * Get all admin/manager users to CC.
 */
async function getManagers() {
  return db('users').where('role', 'Admin').where('is_active', true).select('id', 'name', 'email');
}

/**
 * Build a readable HTML email body for overdue task nudge.
 */
function buildNudgeEmail({ recipientName, tasks, isManager, assigneeName = '' }) {
  const taskRows = tasks.map(t => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${t.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${t.project_name || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#ef4444">${t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-transform:capitalize">${t.status}</td>
    </tr>`).join('');

  const intro = isManager
    ? `<p style="color:#374151">Hi ${recipientName},</p>
       <p style="color:#374151">This is an automated reminder. The following tasks assigned to <strong>${assigneeName}</strong> are overdue and require attention:</p>`
    : `<p style="color:#374151">Hi ${recipientName},</p>
       <p style="color:#374151">This is a friendly reminder that you have overdue tasks that need your attention:</p>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px">Chaos Coordinator</h1>
      <p style="color:#c4b5fd;margin:4px 0 0;font-size:13px">Task Overdue Reminder</p>
    </div>
    <div style="padding:32px">
      ${intro}
      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#374151">Task</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#374151">Project</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#374151">Due Date</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#374151">Status</th>
          </tr>
        </thead>
        <tbody>${taskRows}</tbody>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#9ca3af">
        This is an automated message from Chaos Coordinator. Please log in to update task statuses.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Main nudge function — called by cron or on-demand.
 */
async function runNudgeJob() {
  console.log('🔔 NudgeJob: running at', new Date().toISOString());

  const now = new Date();
  const cutoff24h = new Date(now - 24 * HOUR_MS);
  const cutoff48h = new Date(now - 48 * HOUR_MS);

  try {
    // Fetch overdue tasks (due_date set + not completed + due > 24h ago)
    const overdueTasks = await db('tasks')
      .join('users as assignee', 'tasks.owner_id', 'assignee.id')
      .leftJoin('projects', 'tasks.project_id', 'projects.id')
      .select(
        'tasks.id',
        'tasks.title',
        'tasks.status',
        'tasks.due_date',
        'tasks.owner_id',
        'tasks.project_id',
        'assignee.name as assignee_name',
        'assignee.email as assignee_email',
        'projects.name as project_name',
      )
      .where('tasks.due_date', '<', cutoff24h)
      .whereNotIn('tasks.status', ['completed'])
      .whereNotNull('tasks.due_date');

    if (overdueTasks.length === 0) {
      console.log('🔔 NudgeJob: no overdue tasks found');
      return;
    }

    // Group by assignee
    const byAssignee = {};
    for (const task of overdueTasks) {
      if (!byAssignee[task.owner_id]) {
        byAssignee[task.owner_id] = {
          user_id:  task.owner_id,
          name:     task.assignee_name,
          email:    task.assignee_email,
          tasks:    [],
          tasks48h: [],
        };
      }
      byAssignee[task.owner_id].tasks.push(task);
      if (new Date(task.due_date) < cutoff48h) {
        byAssignee[task.owner_id].tasks48h.push(task);
      }
    }

    const managers = await getManagers();

    for (const assignee of Object.values(byAssignee)) {
      // ── Assignee nudge (24h) ────────────────────────────────────────────
      const newTasks = [];
      for (const task of assignee.tasks) {
        const alreadySent = await nudgeAlreadySent(task.id, assignee.user_id, 'assignee');
        if (!alreadySent) newTasks.push(task);
      }

      if (newTasks.length > 0) {
        // In-app notification
        await createNotification({
          user_id:    assignee.user_id,
          project_id: newTasks[0].project_id,
          task_id:    newTasks[0].id,
          type:       'task_overdue',
          title:      `You have ${newTasks.length} overdue task${newTasks.length > 1 ? 's' : ''}`,
          message:    newTasks.map(t => `• ${t.title} (due ${t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB') : 'N/A'})`).join('\n'),
        });

        // Email to assignee
        await sendEmail({
          to:      assignee.email,
          subject: `[Chaos Coordinator] Action Required: ${newTasks.length} overdue task${newTasks.length > 1 ? 's' : ''} need your attention`,
          html:    buildNudgeEmail({ recipientName: assignee.name, tasks: newTasks, isManager: false }),
        });

        for (const task of newTasks) await logNudgeSent(task.id, assignee.user_id, 'assignee');
        console.log(`🔔 NudgeJob: nudged ${assignee.name} (${assignee.email}) for ${newTasks.length} tasks`);
      }

      // ── Manager escalation (48h) ────────────────────────────────────────
      const escalateTasks = [];
      for (const task of assignee.tasks48h) {
        const alreadySent = await nudgeAlreadySent(task.id, assignee.user_id, 'manager');
        if (!alreadySent) escalateTasks.push(task);
      }

      if (escalateTasks.length > 0 && managers.length > 0) {
        const managerEmails = managers.map(m => m.email);
        const managerNames  = managers.map(m => m.name).join(', ');

        // In-app notification for each manager
        for (const mgr of managers) {
          await createNotification({
            user_id:    mgr.id,
            project_id: escalateTasks[0].project_id,
            task_id:    escalateTasks[0].id,
            type:       'task_nudge_manager',
            title:      `Escalation: ${assignee.name} has ${escalateTasks.length} overdue task${escalateTasks.length > 1 ? 's' : ''} (48h+)`,
            message:    escalateTasks.map(t => `• ${t.title}`).join('\n'),
          });
        }

        // Email: to managers, CC assignee
        await sendEmail({
          to:      managerEmails,
          cc:      [assignee.email],
          subject: `[Chaos Coordinator] Escalation: ${assignee.name} has tasks overdue > 48h`,
          html:    buildNudgeEmail({
            recipientName: managerNames,
            tasks:         escalateTasks,
            isManager:     true,
            assigneeName:  assignee.name,
          }),
        });

        for (const task of escalateTasks) await logNudgeSent(task.id, assignee.user_id, 'manager');
        console.log(`🔔 NudgeJob: escalated ${assignee.name}'s ${escalateTasks.length} tasks to managers`);
      }
    }
  } catch (err) {
    console.error('🔔 NudgeJob error:', err);
  }
}

/**
 * Start the cron schedule.
 * Runs at the top of every hour (0 * * * *).
 */
function startNudgeCron() {
  cron.schedule('0 * * * *', () => {
    runNudgeJob().catch(console.error);
  });
  console.log('🔔 NudgeJob: cron scheduled (hourly)');
}

module.exports = { startNudgeCron, runNudgeJob };
