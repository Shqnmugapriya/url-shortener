const bcrypt = require('bcryptjs');
const db = require('../db');

// Helper to generate a unique random short code
async function generateUniqueShortCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let shortCode;
  let isUnique = false;

  while (!isUnique) {
    shortCode = '';
    for (let i = 0; i < 6; i++) {
      shortCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const check = await db.query('SELECT id FROM urls WHERE short_code = $1', [shortCode]);
    if (check.rows.length === 0) {
      isUnique = true;
    }
  }
  return shortCode;
}

// URL validation helper
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}

// Create a short URL
exports.createUrl = async (req, res) => {
  let { originalUrl, customAlias, password, expiresAt } = req.body;

  if (!originalUrl) {
    return res.status(400).json({ message: 'Original URL is required' });
  }

  // Validate URL format
  if (!isValidUrl(originalUrl)) {
    return res.status(400).json({ message: 'Invalid URL format. Include http:// or https://' });
  }

  try {
    let shortCode = '';

    // Handle Custom Alias
    if (customAlias) {
      // Clean custom alias
      customAlias = customAlias.trim().replace(/[^a-zA-Z0-9-_]/g, '');
      if (customAlias.length < 3) {
        return res.status(400).json({ message: 'Custom alias must be at least 3 characters long' });
      }

      // Check if alias is taken
      const checkAlias = await db.query('SELECT id FROM urls WHERE short_code = $1 OR custom_alias = $2', [customAlias, customAlias]);
      if (checkAlias.rows.length > 0) {
        return res.status(400).json({ message: 'Custom alias is already in use' });
      }
      shortCode = customAlias;
    } else {
      shortCode = await generateUniqueShortCode();
    }

    // Handle password hashing if provided
    let hashedPassword = null;
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password.trim(), salt);
    }

    // Handle expiration date
    let expiration = null;
    if (expiresAt) {
      expiration = new Date(expiresAt);
      if (expiration <= new Date()) {
        return res.status(400).json({ message: 'Expiration date must be in the future' });
      }
    }

    // Insert URL
    const result = await db.query(
      `INSERT INTO urls (user_id, original_url, short_code, custom_alias, password, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, original_url, short_code, custom_alias, expires_at, health_status, created_at, (password IS NOT NULL) AS is_protected`,
      [req.user.id, originalUrl, shortCode, customAlias || null, hashedPassword, expiration]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create URL error:', err.message);
    res.status(500).send('Server Error');
  }
};

// Get all URLs for current user or all URLs if admin
exports.getUrls = async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await db.query(
        `SELECT u.id, u.user_id, u.original_url, u.short_code, u.custom_alias, u.expires_at, u.health_status, u.created_at,
                (u.password IS NOT NULL) AS is_protected,
                COUNT(a.id) AS total_clicks,
                usr.name as owner_name, usr.email as owner_email
         FROM urls u
         LEFT JOIN analytics a ON u.id = a.url_id
         LEFT JOIN users usr ON u.user_id = usr.id
         GROUP BY u.id, usr.name, usr.email
         ORDER BY u.created_at DESC`
      );
    } else {
      result = await db.query(
        `SELECT u.id, u.original_url, u.short_code, u.custom_alias, u.expires_at, u.health_status, u.created_at,
                (u.password IS NOT NULL) AS is_protected,
                COUNT(a.id) AS total_clicks
         FROM urls u
         LEFT JOIN analytics a ON u.id = a.url_id
         WHERE u.user_id = $1
         GROUP BY u.id
         ORDER BY u.created_at DESC`,
        [req.user.id]
      );
    }

    // Parse counts to numbers
    const urls = result.rows.map(row => ({
      ...row,
      total_clicks: parseInt(row.total_clicks || 0, 10)
    }));

    res.json(urls);
  } catch (err) {
    console.error('Get URLs error:', err.message);
    res.status(500).send('Server Error');
  }
};

// Edit a URL (original URL, password, expiresAt)
exports.editUrl = async (req, res) => {
  const { id } = req.params;
  const { originalUrl, password, expiresAt } = req.body;

  if (!originalUrl) {
    return res.status(400).json({ message: 'Original URL is required' });
  }

  if (!isValidUrl(originalUrl)) {
    return res.status(400).json({ message: 'Invalid URL format' });
  }

  try {
    // Check ownership
    const checkUrl = await db.query('SELECT * FROM urls WHERE id = $1', [id]);
    if (checkUrl.rows.length === 0) {
      return res.status(404).json({ message: 'URL not found' });
    }

    const url = checkUrl.rows[0];
    if (req.user.role !== 'admin' && url.user_id !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to edit this URL' });
    }

    // Handle password update if provided
    let passwordSql = 'password = $1';
    let params = [];

    if (password === null || password === '') {
      // Clear password protection
      params = [null, originalUrl, expiresAt ? new Date(expiresAt) : null, id];
    } else if (password === undefined) {
      // Keep existing password
      passwordSql = 'password = password';
      params = [originalUrl, expiresAt ? new Date(expiresAt) : null, id];
    } else {
      // New password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password.trim(), salt);
      params = [hashedPassword, originalUrl, expiresAt ? new Date(expiresAt) : null, id];
    }

    const queryText = password === undefined
      ? `UPDATE urls SET original_url = $1, expires_at = $2, health_status = 'active'
         WHERE id = $3
         RETURNING id, original_url, short_code, custom_alias, expires_at, health_status, created_at, (password IS NOT NULL) AS is_protected`
      : `UPDATE urls SET ${passwordSql}, original_url = $2, expires_at = $3, health_status = 'active'
         WHERE id = $4
         RETURNING id, original_url, short_code, custom_alias, expires_at, health_status, created_at, (password IS NOT NULL) AS is_protected`;

    const result = await db.query(queryText, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Edit URL error:', err.message);
    res.status(500).send('Server Error');
  }
};

// Delete a URL
exports.deleteUrl = async (req, res) => {
  const { id } = req.params;

  try {
    const checkUrl = await db.query('SELECT * FROM urls WHERE id = $1', [id]);
    if (checkUrl.rows.length === 0) {
      return res.status(404).json({ message: 'URL not found' });
    }

    const url = checkUrl.rows[0];
    if (req.user.role !== 'admin' && url.user_id !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to delete this URL' });
    }

    await db.query('DELETE FROM urls WHERE id = $1', [id]);
    res.json({ success: true, message: 'URL deleted successfully' });
  } catch (err) {
    console.error('Delete URL error:', err.message);
    res.status(500).send('Server Error');
  }
};

// Bulk CSV Shortening
exports.bulkShorten = async (req, res) => {
  const { urls } = req.body; // Array of objects: { originalUrl, customAlias, password, expiresAt }

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ message: 'No URLs provided or invalid format' });
  }

  const results = [];
  const errors = [];

  for (let index = 0; index < urls.length; index++) {
    let { originalUrl, customAlias, password, expiresAt } = urls[index];

    if (!originalUrl) {
      errors.push({ row: index + 1, message: 'Original URL is required' });
      continue;
    }

    if (!isValidUrl(originalUrl)) {
      errors.push({ row: index + 1, originalUrl, message: 'Invalid URL format' });
      continue;
    }

    try {
      let shortCode = '';

      if (customAlias) {
        customAlias = customAlias.trim().replace(/[^a-zA-Z0-9-_]/g, '');
        const checkAlias = await db.query('SELECT id FROM urls WHERE short_code = $1 OR custom_alias = $2', [customAlias, customAlias]);
        if (checkAlias.rows.length > 0) {
          errors.push({ row: index + 1, originalUrl, message: `Alias '${customAlias}' is already in use` });
          continue;
        }
        shortCode = customAlias;
      } else {
        shortCode = await generateUniqueShortCode();
      }

      let hashedPassword = null;
      if (password && password.trim() !== '') {
        const salt = await bcrypt.genSalt(10);
        hashedPassword = await bcrypt.hash(password.trim(), salt);
      }

      let expiration = null;
      if (expiresAt) {
        expiration = new Date(expiresAt);
      }

      const result = await db.query(
        `INSERT INTO urls (user_id, original_url, short_code, custom_alias, password, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, original_url, short_code, custom_alias, expires_at, health_status, created_at, (password IS NOT NULL) AS is_protected`,
        [req.user.id, originalUrl, shortCode, customAlias || null, hashedPassword, expiration]
      );

      results.push(result.rows[0]);
    } catch (err) {
      errors.push({ row: index + 1, originalUrl, message: err.message });
    }
  }

  res.json({ success: true, processed: results.length, failures: errors.length, results, errors });
};
