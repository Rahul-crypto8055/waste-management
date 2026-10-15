const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const storage = require('./src/backend/storage');
const cvBridge = require('./src/backend/cvBridge');
const genAi = require('./src/backend/genAiService');

const PORT = 5173;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.mjs': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.bin': 'application/octet-stream'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      // Guard against payloads > 15MB
      if (body.length > 15 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // ==========================================
  // REST API ROUTES (/api/v1/...)
  // ==========================================

  // 1. GET /api/v1/telemetry
  if (req.method === 'GET' && pathname === '/api/v1/telemetry') {
    const data = storage.getTelemetry();
    return sendJson(res, 200, { success: true, ...data });
  }

  // 2. POST /api/v1/scan/item
  if (req.method === 'POST' && pathname === '/api/v1/scan/item') {
    try {
      const body = await parseBody(req);
      const result = storage.saveScanRecord(body);
      return sendJson(res, 200, { success: true, ...result });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 3. POST /api/v1/scan/image
  if (req.method === 'POST' && pathname === '/api/v1/scan/image') {
    try {
      const body = await parseBody(req);
      const cvResult = await cvBridge.analyzeImageWithPython(body.image, body.filename || 'uploaded.jpg');
      
      // Save to database
      const saved = storage.saveScanRecord({
        name: cvResult.data.item_name,
        category: cvResult.data.category,
        categoryLabel: cvResult.data.category_title,
        material: cvResult.data.material_composition,
        massGrams: cvResult.data.mass_grams,
        co2SavedKg: cvResult.data.co2_avoided_kg,
        confidence: cvResult.data.confidence,
        facility: cvResult.data.target_facility
      });

      return sendJson(res, 200, {
        success: true,
        cvAnalysis: cvResult,
        savedRecord: saved.record,
        telemetry: saved.telemetry,
        facilities: saved.facilities
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 4. POST /api/v1/facilities/purge
  if (req.method === 'POST' && pathname === '/api/v1/facilities/purge') {
    try {
      const body = await parseBody(req);
      const result = storage.purgeFacilityBin(body.category);
      return sendJson(res, result.success ? 200 : 400, result);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 5. POST /api/v1/genai/advise
  if (req.method === 'POST' && pathname === '/api/v1/genai/advise') {
    try {
      const body = await parseBody(req);
      const advice = await genAi.generateRecommendations(body);
      return sendJson(res, 200, { success: true, advice });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 6. POST /api/v1/genai/chat
  if (req.method === 'POST' && pathname === '/api/v1/genai/chat') {
    try {
      const body = await parseBody(req);
      const reply = await genAi.processChatQuery(body.query);
      return sendJson(res, 200, { success: true, ...reply });
    } catch (err) {
      return sendJson(res, 400, { success: false, error: err.message });
    }
  }

  // 7. GET /api/v1/logs
  if (req.method === 'GET' && pathname === '/api/v1/logs') {
    const limit = parseInt(parsedUrl.query.limit, 10) || 50;
    const category = parsedUrl.query.category || null;
    const logs = storage.getScans(limit, category);
    return sendJson(res, 200, { success: true, count: logs.length, logs });
  }

  // 8. GET /api/v1/logs/export
  if (req.method === 'GET' && pathname === '/api/v1/logs/export') {
    const format = parsedUrl.query.format === 'csv' ? 'csv' : 'json';
    const exportData = storage.exportScans(format);
    res.writeHead(200, {
      'Content-Type': exportData.mime,
      'Content-Disposition': `attachment; filename="${exportData.filename}"`,
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(exportData.data);
  }

  // ==========================================
  // STATIC FILE SERVING
  // ==========================================
  let reqUrl = pathname;
  if (reqUrl === '/') reqUrl = '/index.html';

  let filePath = path.join(ROOT, reqUrl);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(ROOT, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('500 Internal Server Error');
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    });
  });
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

setInterval(() => {}, 1000 * 60 * 60);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Smart Recycling Assistant Backend & UI active at http://localhost:${PORT}`);
});
