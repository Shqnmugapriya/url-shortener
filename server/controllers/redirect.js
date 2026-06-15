const bcrypt = require('bcryptjs');
const useragent = require('useragent');
const db = require('../db');

// Helper to parse device type from user-agent string
function getDeviceType(uaString) {
  const ua = uaString.toLowerCase();
  if (ua.includes('ipad') || ua.includes('tablet') || (ua.includes('android') && !ua.includes('mobile'))) {
    return 'Tablet';
  }
  if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
    return 'Mobile';
  }
  return 'Desktop';
}

// Helper to parse browser name from user-agent
function getBrowserName(uaString) {
  const agent = useragent.parse(uaString);
  const family = agent.family.toLowerCase();
  
  if (family.includes('chrome')) return 'Chrome';
  if (family.includes('firefox')) return 'Firefox';
  if (family.includes('safari')) return 'Safari';
  if (family.includes('edge')) return 'Edge';
  if (family.includes('ie') || family.includes('internet explorer')) return 'Internet Explorer';
  
  return agent.family || 'Other';
}

// Helper to generate mock geographic data for demo/localhost testing
function getMockGeo() {
  const locations = [
    { country: 'United States', region: 'California', city: 'San Francisco' },
    { country: 'United States', region: 'New York', city: 'New York City' },
    { country: 'India', region: 'Karnataka', city: 'Bengaluru' },
    { country: 'India', region: 'Maharashtra', city: 'Mumbai' },
    { country: 'United Kingdom', region: 'England', city: 'London' },
    { country: 'Germany', region: 'Berlin', city: 'Berlin' },
    { country: 'Canada', region: 'Ontario', city: 'Toronto' },
    { country: 'Australia', region: 'New South Wales', city: 'Sydney' },
    { country: 'Japan', region: 'Tokyo', city: 'Tokyo' },
    { country: 'Brazil', region: 'Sao Paulo', city: 'Sao Paulo' }
  ];
  return locations[Math.floor(Math.random() * locations.length)];
}

// Helper to parse referrer source
function getReferrerSource(refererHeader) {
  if (!refererHeader || refererHeader === '') {
    return 'Direct';
  }
  
  try {
    const url = new URL(refererHeader);
    const host = url.hostname.toLowerCase();
    
    if (host.includes('facebook.com') || host.includes('fb.me') || host.includes('m.facebook.com')) {
      return 'Facebook';
    }
    if (host.includes('twitter.com') || host.includes('t.co') || host.includes('x.com')) {
      return 'Twitter / X';
    }
    if (host.includes('linkedin.com')) {
      return 'LinkedIn';
    }
    if (host.includes('instagram.com')) {
      return 'Instagram';
    }
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return 'YouTube';
    }
    if (host.includes('reddit.com')) {
      return 'Reddit';
    }
    
    return url.hostname; // Return the hostname of the external site
  } catch (err) {
    return 'Other';
  }
}

// Helper to record analytics and check milestones
async function recordClick(url, req, io) {
  const uaString = req.headers['user-agent'] || '';
  const device = getDeviceType(uaString);
  const browser = getBrowserName(uaString);
  const referer = req.headers['referer'] || req.headers['referrer'] || '';
  const referrer = getReferrerSource(referer);
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  
  // Get mock geo data for rich dashboard analytics
  const geo = getMockGeo();
  
  try {
    // 1. Insert analytics record
    await db.query(
      `INSERT INTO analytics (url_id, ip_address, device, browser, country, region, city, referrer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [url.id, ipAddress, device, browser, geo.country, geo.region, geo.city, referrer]
    );
    
    // 2. Fetch total clicks count for this URL
    const clickCountRes = await db.query('SELECT COUNT(id) AS count FROM analytics WHERE url_id = $1', [url.id]);
    const clicks = parseInt(clickCountRes.rows[0].count, 10);
    
    // 3. Prepare socket payload for real-time dashboard update
    const newClickEvent = {
      urlId: url.id,
      shortCode: url.short_code,
      visitTime: new Date(),
      device,
      browser,
      country: geo.country,
      city: geo.city,
      referrer,
      totalClicks: clicks
    };
    
    // Broadcast click to user if socket is active
    if (io) {
      io.to(`user_${url.user_id}`).emit('new_click', newClickEvent);
    }
    
    // 4. Milestone Notification Check
    const milestones = [5, 10, 50, 100, 500, 1000];
    if (milestones.includes(clicks)) {
      const message = `Milestone reached! Your URL shortly.com/${url.short_code} has reached ${clicks} clicks.`;
      
      const newNotif = await db.query(
        `INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3) RETURNING *`,
        [url.user_id, 'milestone', message]
      );
      
      if (io) {
        io.to(`user_${url.user_id}`).emit('new_notification', newNotif.rows[0]);
      }
    }
  } catch (err) {
    console.error('Failed to record click analytics:', err);
  }
}

// Redirect short URL to destination URL
exports.handleRedirect = (io) => async (req, res) => {
  const { shortCode } = req.params;

  try {
    // Fetch URL
    const result = await db.query('SELECT * FROM urls WHERE short_code = $1', [shortCode]);
    if (result.rows.length === 0) {
      return res.status(404).send('<h1>404 - Link Not Found</h1><p>The link you are trying to access does not exist on this platform.</p>');
    }

    const url = result.rows[0];

    // Check expiration
    if (url.expires_at && new Date(url.expires_at) <= new Date()) {
      // Create a notification about expiration if not already done
      const checkNotif = await db.query(
        `SELECT id FROM notifications WHERE user_id = $1 AND type = 'expiration' AND message LIKE $2`,
        [url.user_id, `%${shortCode}%`]
      );
      if (checkNotif.rows.length === 0) {
        const msg = `Your shortened link shortly.com/${shortCode} has expired.`;
        const notif = await db.query(
          `INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3) RETURNING *`,
          [url.user_id, 'expiration', msg]
        );
        if (io) {
          io.to(`user_${url.user_id}`).emit('new_notification', notif.rows[0]);
        }
      }
      return res.status(410).send('<h1>410 - Link Expired</h1><p>This shortened link has reached its expiration date and is no longer active.</p>');
    }

    // Check password protection
    if (url.password && url.password !== '') {
      // Redirect to frontend challenge screen
      // Typically, client is on port 5173 or 5000 depending on environment.
      // We redirect browser to client unlock route
      const clientUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173';
      return res.redirect(`${clientUrl}/unlock/${shortCode}`);
    }

    // Record click analytics asynchronously so redirection is fast
    recordClick(url, req, io);

    // Redirect to original URL
    res.redirect(302, url.original_url);
  } catch (err) {
    console.error('Redirect error:', err.message);
    res.status(500).send('Server Error');
  }
};

// Verify password for protected links
exports.verifyPasswordAndRedirect = (io) => async (req, res) => {
  const { shortCode } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'Password is required' });
  }

  try {
    const result = await db.query('SELECT * FROM urls WHERE short_code = $1', [shortCode]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Link not found' });
    }

    const url = result.rows[0];

    // Check expiration
    if (url.expires_at && new Date(url.expires_at) <= new Date()) {
      return res.status(410).json({ message: 'Link has expired' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, url.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Record click analytics
    await recordClick(url, req, io);

    res.json({ originalUrl: url.original_url });
  } catch (err) {
    console.error('Verify password error:', err.message);
    res.status(500).send('Server error');
  }
};
