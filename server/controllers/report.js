const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { createObjectCsvWriter } = require('csv-writer');
const db = require('../db');

// Helper to check ownership
async function checkUrlOwner(urlId, userId, userRole) {
  const result = await db.query('SELECT * FROM urls WHERE id = $1', [urlId]);
  if (result.rows.length === 0) return null;
  const url = result.rows[0];
  if (userRole !== 'admin' && url.user_id !== userId) return null;
  return url;
}

// 1. Export Click Logs to CSV
exports.exportCSV = async (req, res) => {
  const { urlId } = req.params;

  try {
    const url = await checkUrlOwner(urlId, req.user.id, req.user.role);
    if (!url) {
      return res.status(401).json({ message: 'Unauthorized or URL not found' });
    }

    // Fetch click logs
    const clickLogs = await db.query(
      `SELECT visit_time, ip_address, device, browser, country, region, city, referrer
       FROM analytics WHERE url_id = $1 ORDER BY visit_time DESC`,
      [urlId]
    );

    // Setup temporary filepath
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFilePath = path.join(tempDir, `clicks_${url.short_code}_${Date.now()}.csv`);

    const csvWriter = createObjectCsvWriter({
      path: tempFilePath,
      header: [
        { id: 'visit_time', title: 'Visit Time' },
        { id: 'ip_address', title: 'IP Address' },
        { id: 'device', title: 'Device Type' },
        { id: 'browser', title: 'Browser Name' },
        { id: 'country', title: 'Country' },
        { id: 'region', title: 'Region/State' },
        { id: 'city', title: 'City' },
        { id: 'referrer', title: 'Referrer Source' }
      ]
    });

    const records = clickLogs.rows.map(row => ({
      visit_time: new Date(row.visit_time).toISOString(),
      ip_address: row.ip_address,
      device: row.device,
      browser: row.browser,
      country: row.country,
      region: row.region,
      city: row.city,
      referrer: row.referrer
    }));

    await csvWriter.writeRecords(records);

    res.download(tempFilePath, `analytics_${url.short_code}.csv`, (err) => {
      if (err) console.error('CSV download error:', err);
      // Delete temporary file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (unlinkErr) {
        console.error('Failed to delete temp CSV file:', unlinkErr);
      }
    });
  } catch (err) {
    console.error('Export CSV error:', err.message);
    res.status(500).send('Server Error');
  }
};

// 2. Export Click Logs to Excel (.xlsx)
exports.exportExcel = async (req, res) => {
  const { urlId } = req.params;

  try {
    const url = await checkUrlOwner(urlId, req.user.id, req.user.role);
    if (!url) {
      return res.status(401).json({ message: 'Unauthorized or URL not found' });
    }

    const clickLogs = await db.query(
      `SELECT visit_time, ip_address, device, browser, country, region, city, referrer
       FROM analytics WHERE url_id = $1 ORDER BY visit_time DESC`,
      [urlId]
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Click Analytics');

    // Setup columns and headers
    worksheet.columns = [
      { header: 'Visit Time', key: 'visit_time', width: 25 },
      { header: 'IP Address', key: 'ip_address', width: 18 },
      { header: 'Device', key: 'device', width: 15 },
      { header: 'Browser', key: 'browser', width: 18 },
      { header: 'Country', key: 'country', width: 20 },
      { header: 'Region', key: 'region', width: 20 },
      { header: 'City', key: 'city', width: 20 },
      { header: 'Referrer', key: 'referrer', width: 25 }
    ];

    // Format headers (bold and indigo background)
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' } // Indigo color
    };

    // Add rows
    clickLogs.rows.forEach(row => {
      worksheet.addRow({
        visit_time: new Date(row.visit_time).toLocaleString(),
        ip_address: row.ip_address,
        device: row.device,
        browser: row.browser,
        country: row.country,
        region: row.region,
        city: row.city,
        referrer: row.referrer
      });
    });

    // Write file to response stream directly
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=analytics_${url.short_code}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export Excel error:', err.message);
    res.status(500).send('Server Error');
  }
};

// 3. Export Summary and Logs to PDF
exports.exportPDF = async (req, res) => {
  const { urlId } = req.params;

  try {
    const url = await checkUrlOwner(urlId, req.user.id, req.user.role);
    if (!url) {
      return res.status(401).json({ message: 'Unauthorized or URL not found' });
    }

    // Fetch counts and click logs
    const clickLogs = await db.query(
      `SELECT visit_time, ip_address, device, browser, country, city, referrer
       FROM analytics WHERE url_id = $1 ORDER BY visit_time DESC`,
      [urlId]
    );

    const totalClicks = clickLogs.rows.length;

    // Initialize PDF document
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report_${url.short_code}.pdf`);

    doc.pipe(res);

    // 1. Header
    doc.fillColor('#1E1B4B').fontSize(24).font('Helvetica-Bold').text('URL Analytics Report', { align: 'center' });
    doc.fillColor('#6B7280').fontSize(12).font('Helvetica').text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);

    // 2. Summary Box
    doc.fillColor('#F3F4F6').rect(50, doc.y, 512, 120).fill();
    doc.fillColor('#1E1B4B').fontSize(14).font('Helvetica-Bold').text('  Link Information', 60, doc.y + 10);
    
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    doc.text(`  Short URL: shortly.com/${url.short_code}`, 60, doc.y + 5);
    doc.text(`  Original Destination: ${url.original_url.length > 65 ? url.original_url.substring(0, 65) + '...' : url.original_url}`, 60, doc.y + 5);
    doc.text(`  Created Date: ${new Date(url.created_at).toLocaleDateString()}`, 60, doc.y + 5);
    doc.text(`  Link Health Status: ${url.health_status.toUpperCase()}`, 60, doc.y + 5);
    doc.text(`  Total Visitor Clicks: ${totalClicks}`, 60, doc.y + 5);
    
    doc.moveDown(4);

    // 3. Table Header
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E1B4B').text('Recent Visits (Up to 50)', 50);
    doc.moveDown(0.5);

    const tableTop = doc.y;
    doc.rect(50, tableTop, 512, 20).fill('#4F46E5');
    
    // Header labels
    doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
    doc.text('Visit Time', 60, tableTop + 5, { width: 120 });
    doc.text('Device', 180, tableTop + 5, { width: 60 });
    doc.text('Browser', 240, tableTop + 5, { width: 70 });
    doc.text('Location', 310, tableTop + 5, { width: 110 });
    doc.text('Referrer', 430, tableTop + 5, { width: 120 });

    let currentY = tableTop + 20;
    doc.fillColor('#374151').font('Helvetica');

    // Limit to 50 clicks in PDF for length limits
    const rowsToPrint = clickLogs.rows.slice(0, 50);

    rowsToPrint.forEach((row, i) => {
      // Handle page break
      if (currentY > 700) {
        doc.addPage();
        // Reprint header on new page
        const newTableTop = 50;
        doc.rect(50, newTableTop, 512, 20).fill('#4F46E5');
        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
        doc.text('Visit Time', 60, newTableTop + 5, { width: 120 });
        doc.text('Device', 180, newTableTop + 5, { width: 60 });
        doc.text('Browser', 240, newTableTop + 5, { width: 70 });
        doc.text('Location', 310, newTableTop + 5, { width: 110 });
        doc.text('Referrer', 430, newTableTop + 5, { width: 120 });
        
        currentY = newTableTop + 20;
        doc.fillColor('#374151').font('Helvetica');
      }

      // Alternate row backgrounds
      if (i % 2 === 0) {
        doc.fillColor('#F9FAFB').rect(50, currentY, 512, 20).fill();
      }

      doc.fillColor('#374151').fontSize(9);
      doc.text(new Date(row.visit_time).toLocaleString(), 60, currentY + 5, { width: 120 });
      doc.text(row.device, 180, currentY + 5, { width: 60 });
      doc.text(row.browser, 240, currentY + 5, { width: 70 });
      doc.text(`${row.city}, ${row.country}`, 310, currentY + 5, { width: 110 });
      doc.text(row.referrer, 430, currentY + 5, { width: 120 });

      currentY += 20;
    });

    doc.end();
  } catch (err) {
    console.error('Export PDF error:', err.message);
    res.status(500).send('Server Error');
  }
};
