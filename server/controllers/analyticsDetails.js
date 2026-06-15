const db = require('../db');

// Get detailed analytics for a single URL
exports.getUrlAnalytics = async (req, res) => {
  const { urlId } = req.params;

  try {
    // 1. Check ownership of the URL first
    const checkUrl = await db.query('SELECT * FROM urls WHERE id = $1', [urlId]);
    if (checkUrl.rows.length === 0) {
      return res.status(404).json({ message: 'URL not found' });
    }

    const url = checkUrl.rows[0];
    if (req.user.role !== 'admin' && url.user_id !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to view analytics for this URL' });
    }

    // 2. Fetch click counts (total and unique)
    const clicksRes = await db.query('SELECT COUNT(id) AS count FROM analytics WHERE url_id = $1', [urlId]);
    const totalClicks = parseInt(clicksRes.rows[0].count || 0, 10);

    const uniqueClicksRes = await db.query('SELECT COUNT(DISTINCT ip_address) AS count FROM analytics WHERE url_id = $1', [urlId]);
    const uniqueClicks = parseInt(uniqueClicksRes.rows[0].count || 0, 10);

    // 3. Fetch last visited time
    const lastVisitRes = await db.query('SELECT visit_time FROM analytics WHERE url_id = $1 ORDER BY visit_time DESC LIMIT 1', [urlId]);
    const lastVisitedTime = lastVisitRes.rows.length > 0 ? lastVisitRes.rows[0].visit_time : null;

    // Calculate Avg Clicks / Day
    const createdDate = new Date(url.created_at);
    const diffTime = Math.abs(new Date() - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const avgClicks = parseFloat((totalClicks / diffDays).toFixed(1));

    // 4. Fetch recent click history (last 30 visits)
    const historyRes = await db.query(
      `SELECT visit_time, ip_address, device, browser, country, city, referrer
       FROM analytics
       WHERE url_id = $1
       ORDER BY visit_time DESC
       LIMIT 30`,
      [urlId]
    );

    // 5. Fetch Daily Click Trend (last 30 days)
    const trendRes = await db.query(
      `SELECT DATE(visit_time) AS click_date, COUNT(id) AS clicks
       FROM analytics
       WHERE url_id = $1 AND visit_time >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(visit_time)
       ORDER BY click_date ASC`,
      [urlId]
    );

    // 6. Fetch Device Distribution
    const deviceRes = await db.query(
      `SELECT device, COUNT(id) AS count
       FROM analytics
       WHERE url_id = $1
       GROUP BY device`,
      [urlId]
    );

    // 7. Fetch Browser Distribution
    const browserRes = await db.query(
      `SELECT browser, COUNT(id) AS count
       FROM analytics
       WHERE url_id = $1
       GROUP BY browser`,
      [urlId]
    );

    // 8. Fetch Geographic Distribution (Countries)
    const geoRes = await db.query(
      `SELECT country, COUNT(id) AS count
       FROM analytics
       WHERE url_id = $1
       GROUP BY country
       ORDER BY count DESC
       LIMIT 10`,
      [urlId]
    );

    // 9. Fetch Traffic Referrer Distribution
    const referrerRes = await db.query(
      `SELECT referrer, COUNT(id) AS count
       FROM analytics
       WHERE url_id = $1
       GROUP BY referrer
       ORDER BY count DESC`,
      [urlId]
    );

    res.json({
      urlInfo: {
        id: url.id,
        originalUrl: url.original_url,
        shortCode: url.short_code,
        customAlias: url.custom_alias,
        expiresAt: url.expires_at,
        healthStatus: url.health_status,
        createdAt: url.created_at,
        isProtected: !!url.password
      },
      metrics: {
        totalClicks,
        uniqueClicks,
        avgClicks,
        lastVisitedTime
      },
      recentHistory: historyRes.rows,
      charts: {
        clickTrend: trendRes.rows.map(r => ({
          date: new Date(r.click_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          clicks: parseInt(r.clicks, 10)
        })),
        devices: deviceRes.rows.map(r => ({ name: r.device, value: parseInt(r.count, 10) })),
        browsers: browserRes.rows.map(r => ({ name: r.browser, value: parseInt(r.count, 10) })),
        countries: geoRes.rows.map(r => ({ name: r.country, value: parseInt(r.count, 10) })),
        referrers: referrerRes.rows.map(r => ({ name: r.referrer, value: parseInt(r.count, 10) }))
      }
    });
  } catch (err) {
    console.error('Get URL analytics error:', err.message);
    res.status(500).send('Server Error');
  }
};

// Get System-Wide Analytics for Admin Dashboard
exports.getGlobalAnalytics = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Administrators only' });
  }

  try {
    // 1. Total users
    const usersCount = await db.query('SELECT COUNT(id) FROM users WHERE role = $1', ['user']);
    const totalUsers = parseInt(usersCount.rows[0].count || 0, 10);

    // 2. Total URLs
    const urlsCount = await db.query('SELECT COUNT(id) FROM urls');
    const totalUrls = parseInt(urlsCount.rows[0].count || 0, 10);

    // 3. Total Clicks
    const clicksCount = await db.query('SELECT COUNT(id) FROM analytics');
    const totalClicks = parseInt(clicksCount.rows[0].count || 0, 10);

    // 4. Broken URLs
    const brokenCount = await db.query("SELECT COUNT(id) FROM urls WHERE health_status = 'broken'");
    const brokenUrls = parseInt(brokenCount.rows[0].count || 0, 10);

    // 5. User management details (list of users with their link & click counts)
    const userList = await db.query(
      `SELECT usr.id, usr.name, usr.email, usr.created_at,
              COUNT(DISTINCT u.id) AS total_urls,
              COUNT(a.id) AS total_clicks
       FROM users usr
       LEFT JOIN urls u ON usr.id = u.user_id
       LEFT JOIN analytics a ON u.id = a.url_id
       WHERE usr.role = 'user'
       GROUP BY usr.id
       ORDER BY usr.created_at DESC`
    );

    // 6. Global daily click trends (last 30 days)
    const globalTrend = await db.query(
      `SELECT DATE(visit_time) AS click_date, COUNT(id) AS clicks
       FROM analytics
       WHERE visit_time >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(visit_time)
       ORDER BY click_date ASC`
    );

    res.json({
      summary: {
        totalUsers,
        totalUrls,
        totalClicks,
        brokenUrls
      },
      users: userList.rows.map(u => ({
        ...u,
        total_urls: parseInt(u.total_urls || 0, 10),
        total_clicks: parseInt(u.total_clicks || 0, 10)
      })),
      charts: {
        clickTrend: globalTrend.rows.map(r => ({
          date: new Date(r.click_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          clicks: parseInt(r.clicks, 10)
        }))
      }
    });
  } catch (err) {
    console.error('Get global analytics error:', err.message);
    res.status(500).send('Server Error');
  }
};

// Get aggregated overview stats for all links owned by the current user
exports.getUserOverviewAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch total click count across all user links
    const totalClicksRes = await db.query(
      `SELECT COUNT(a.id) AS count 
       FROM analytics a 
       JOIN urls u ON a.url_id = u.id 
       WHERE u.user_id = $1`,
      [userId]
    );
    const totalClicks = parseInt(totalClicksRes.rows[0].count || 0, 10);

    // 2. Fetch unique click count (distinct IP addresses)
    const uniqueClicksRes = await db.query(
      `SELECT COUNT(DISTINCT a.ip_address) AS count 
       FROM analytics a 
       JOIN urls u ON a.url_id = u.id 
       WHERE u.user_id = $1`,
      [userId]
    );
    const uniqueClicks = parseInt(uniqueClicksRes.rows[0].count || 0, 10);

    // 3. Calculate Avg Clicks / Day
    const minCreatedRes = await db.query('SELECT MIN(created_at) AS min_date FROM urls WHERE user_id = $1', [userId]);
    const minDateRaw = minCreatedRes.rows[0].min_date;
    const minDate = minDateRaw ? new Date(minDateRaw) : new Date();
    const diffTime = Math.abs(new Date() - minDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const avgClicks = parseFloat((totalClicks / diffDays).toFixed(1));

    // 4. Fetch Top Country
    const topCountryRes = await db.query(
      `SELECT a.country, COUNT(a.id) AS count
       FROM analytics a
       JOIN urls u ON a.url_id = u.id
       WHERE u.user_id = $1
       GROUP BY a.country
       ORDER BY count DESC
       LIMIT 1`,
      [userId]
    );
    const topCountry = topCountryRes.rows.length > 0 ? topCountryRes.rows[0].country : 'None';

    // 5. Fetch Daily Click Trend (last 30 days)
    const trendRes = await db.query(
      `SELECT DATE(a.visit_time) AS click_date, COUNT(a.id) AS clicks
       FROM analytics a
       JOIN urls u ON a.url_id = u.id
       WHERE u.user_id = $1 AND a.visit_time >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(a.visit_time)
       ORDER BY click_date ASC`,
      [userId]
    );

    // 6. Fetch Top Referrers
    const referrerRes = await db.query(
      `SELECT a.referrer, COUNT(a.id) AS count
       FROM analytics a
       JOIN urls u ON a.url_id = u.id
       WHERE u.user_id = $1
       GROUP BY a.referrer
       ORDER BY count DESC`,
      [userId]
    );

    res.json({
      metrics: {
        totalClicks,
        uniqueClicks,
        avgClicks,
        topCountry
      },
      charts: {
        clickTrend: trendRes.rows.map(r => ({
          date: new Date(r.click_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          clicks: parseInt(r.clicks, 10)
        })),
        referrers: referrerRes.rows.map(r => ({ name: r.referrer, value: parseInt(r.count, 10) }))
      }
    });
  } catch (err) {
    console.error('Get user overview analytics error:', err.message);
    res.status(500).send('Server Error');
  }
};

