const db = require('../db');

// Periodically check the health of all active (non-expired) original URLs
async function runHealthCheck(io) {
  try {
    // Select all URLs that have not expired
    const result = await db.query(
      `SELECT id, user_id, original_url, short_code, health_status
       FROM urls
       WHERE expires_at IS NULL OR expires_at > NOW()`
    );

    const urls = result.rows;
    console.log(`[Health Checker] Starting verification of ${urls.length} links...`);

    for (const url of urls) {
      let status = 'active';
      const startTime = Date.now();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

        const response = await fetch(url.original_url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Shortly HealthChecker/1.0)'
          }
        });

        clearTimeout(timeoutId);

        if (response.ok || (response.status >= 300 && response.status < 400)) {
          status = 'active';
        } else {
          status = 'broken';
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          status = 'timeout';
        } else {
          status = 'broken';
        }
      }

      // If health status changed, update the DB and notify the user
      if (status !== url.health_status) {
        console.log(`[Health Checker] Status changed for shortly.com/${url.short_code} from ${url.health_status} to ${status}`);

        // Update database
        await db.query(
          `UPDATE urls SET health_status = $1, last_health_check = NOW() WHERE id = $2`,
          [status, url.id]
        );

        // Notify user if status is bad
        if (status !== 'active') {
          const type = 'health_check';
          const message = `Health warning: Your shortened URL shortly.com/${url.short_code} pointing to ${url.original_url.substring(0, 40)}... has status: ${status.toUpperCase()}. Please verify the link.`;

          const notif = await db.query(
            `INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3) RETURNING *`,
            [url.user_id, type, message]
          );

          // Real-time notification broadcast
          if (io) {
            io.to(`user_${url.user_id}`).emit('new_notification', notif.rows[0]);
            // Also notify URL list update
            io.to(`user_${url.user_id}`).emit('url_health_update', { urlId: url.id, healthStatus: status });
          }
        } else {
          // If it returned to active, just notify URL list update
          if (io) {
            io.to(`user_${url.user_id}`).emit('url_health_update', { urlId: url.id, healthStatus: status });
          }
        }
      } else {
        // Just update last health check timestamp
        await db.query(
          `UPDATE urls SET last_health_check = NOW() WHERE id = $1`,
          [url.id]
        );
      }
    }
    console.log('[Health Checker] Link health check verification completed.');
  } catch (err) {
    console.error('[Health Checker] Error during verification execution:', err);
  }
}

module.exports = {
  runHealthCheck
};
