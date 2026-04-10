/**
 * Notifications API Routes
 * Base: /api/notifications
 */
const express = require('express');
const router = express.Router();
const db = require('../../database/connection');

// GET /api/notifications?user_id=X — fetch notifications for a user
router.get('/', async (req, res) => {
  try {
    const { user_id, limit = 30 } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const rows = await db('notifications')
      .where('user_id', user_id)
      .orderBy('created_at', 'desc')
      .limit(Number(limit));

    res.json(rows);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count?user_id=X
router.get('/unread-count', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const [{ count }] = await db('notifications')
      .where({ user_id, is_read: false })
      .count('id as count');

    res.json({ count: Number(count) });
  } catch (err) {
    console.error('Error counting notifications:', err);
    res.status(500).json({ error: 'Failed to count notifications' });
  }
});

// POST /api/notifications/:id/read — mark one as read
router.post('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await db('notifications').where('id', id).update({ is_read: true, updated_at: new Date() });
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// POST /api/notifications/read-all?user_id=X — mark all as read
router.post('/read-all', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    await db('notifications').where({ user_id, is_read: false }).update({ is_read: true, updated_at: new Date() });
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all read:', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

module.exports = router;
