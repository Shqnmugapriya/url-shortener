const db = require('../db');

// Get all notifications for current user
exports.getNotifications = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get notifications error:', err.message);
    res.status(500).send('Server Error');
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Mark notification read error:', err.message);
    res.status(500).send('Server Error');
  }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all notifications read error:', err.message);
    res.status(500).send('Server Error');
  }
};
