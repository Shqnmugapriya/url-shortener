// Automated backend integration testing script
const http = require('http');
const db = require('./db');

async function testBackend() {
  console.log('--- Starting Backend Automated Integration Tests ---');
  
  // Clear any existing test accounts/data to ensure a clean test run
  try {
    await db.query("DELETE FROM users WHERE email = 'testuser@test.com' OR email = 'testadmin@test.com'");
    console.log('Cleaned up previous test users.');
  } catch (err) {
    console.warn('Cleanup warning (can be ignored):', err.message);
  }

  // Import and start server
  const server = require('./index');
  
  // Wait 3 seconds for server/db connection to spin up
  await new Promise(resolve => setTimeout(resolve, 3000));

  let testUserToken = '';
  let testUserId = null;
  let testUrlId = null;
  const testShortCode = 'testalias' + Math.floor(Math.random() * 100);

  // Helper to perform HTTP JSON requests to our local server
  const makeRequest = (method, path, body, headers = {}) => {
    return new Promise((resolve, reject) => {
      const dataString = body ? JSON.stringify(body) : '';
      
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataString),
          ...headers
        }
      };

      const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          try {
            const parsed = responseBody ? JSON.parse(responseBody) : {};
            resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
          } catch (err) {
            resolve({ statusCode: res.statusCode, headers: res.headers, rawBody: responseBody });
          }
        });
      });

      req.on('error', err => reject(err));
      if (body) req.write(dataString);
      req.end();
    });
  };

  try {
    // 1. Test Signup API
    console.log('\nTest 1: User Signup');
    const signupRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Test User',
      email: 'testuser@test.com',
      password: 'testpassword'
    });
    
    if (signupRes.statusCode === 200 && signupRes.body.user.email === 'testuser@test.com') {
      console.log('✅ Signup API passed.');
      testUserId = signupRes.body.user.id;
    } else {
      throw new Error(`Signup failed: Status ${signupRes.statusCode}, Body: ${JSON.stringify(signupRes.body)}`);
    }

    // 2. Test Login API
    console.log('\nTest 2: User Login');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'testuser@test.com',
      password: 'testpassword'
    });
    
    if (loginRes.statusCode === 200 && loginRes.body.token) {
      console.log('✅ Login API passed.');
      testUserToken = loginRes.body.token;
    } else {
      throw new Error(`Login failed: Status ${loginRes.statusCode}`);
    }

    // 3. Test Create Short URL API
    console.log('\nTest 3: URL Shortening');
    const createUrlRes = await makeRequest('POST', '/api/urls', {
      originalUrl: 'https://www.google.com/search?q=technology',
      customAlias: testShortCode
    }, { 'Authorization': `Bearer ${testUserToken}` });

    if (createUrlRes.statusCode === 200 && createUrlRes.body.short_code === testShortCode) {
      console.log(`✅ URL creation passed. Short link generated: shortly.com/${testShortCode}`);
      testUrlId = createUrlRes.body.id;
    } else {
      throw new Error(`URL creation failed: Status ${createUrlRes.statusCode}, Body: ${JSON.stringify(createUrlRes.body)}`);
    }

    // 4. Test Short URL Redirection API
    console.log('\nTest 4: URL Redirection & Analytics Capture');
    // Call the redirect endpoint (GET /:shortCode)
    const redirectRes = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: `/${testShortCode}`,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
          'Referer': 'https://facebook.com/'
        }
      };

      const req = http.request(options, (res) => {
        resolve({ statusCode: res.statusCode, headers: res.headers });
      });
      req.on('error', err => reject(err));
      req.end();
    });

    // We expect a 302 redirect pointing back to original URL
    if (redirectRes.statusCode === 302 && redirectRes.headers.location === 'https://www.google.com/search?q=technology') {
      console.log('✅ URL redirection passed (302 Found redirecting to target).');
    } else {
      throw new Error(`Redirection failed: Status ${redirectRes.statusCode}, Location: ${redirectRes.headers.location}`);
    }

    // Wait a brief moment for asynchronous analytics database save
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 5. Test Fetch URL Analytics API
    console.log('\nTest 5: Analytics Reporting Stats');
    const analyticsRes = await makeRequest('GET', `/api/analytics/${testUrlId}`, null, {
      'Authorization': `Bearer ${testUserToken}`
    });

    if (analyticsRes.statusCode === 200 && analyticsRes.body.metrics.totalClicks === 1) {
      console.log('✅ Click count recorded correctly in database.');
      const recent = analyticsRes.body.recentHistory[0];
      if (recent.device === 'Mobile' && recent.browser === 'Safari' && recent.referrer === 'Facebook') {
        console.log('✅ Visitor User-Agent and Referrer parsed correctly.');
      } else {
        console.warn('⚠️ User-Agent parsing results: ', recent);
      }
    } else {
      throw new Error(`Analytics failed: Status ${analyticsRes.statusCode}, Clicks: ${analyticsRes.body?.metrics?.totalClicks}`);
    }

    // 6. Test PDF Report Download Endpoint
    console.log('\nTest 6: PDF Report Export');
    const pdfRes = await new Promise((resolve) => {
      http.get(`http://localhost:5000/api/reports/pdf/${testUrlId}?token=${testUserToken}`, {
        headers: { 'Authorization': `Bearer ${testUserToken}` }
      }, (res) => {
        resolve({ statusCode: res.statusCode, headers: res.headers });
      });
    });

    if (pdfRes.statusCode === 200 && pdfRes.headers['content-type'] === 'application/pdf') {
      console.log('✅ PDF export endpoint returns 200 OK and PDF content type header.');
    } else {
      throw new Error(`PDF export failed: Status ${pdfRes.statusCode}, Content-Type: ${pdfRes.headers['content-type']}`);
    }

    // Clean up database test data
    console.log('\nCleaning up database test records...');
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    console.log('✅ Database clean up completed.');
    
    console.log('\n🏆 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! backend code is stable.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ INTEGRATION TEST FAILED:', err.message);
    process.exit(1);
  }
}

testBackend();
