/**
 * Vercel serverless API for the Smart Recycling Assistant.
 *
 * Vercel is serverless, so the always-on Node server (server.js, used for local
 * dev) can't run here. This single catch-all function handles every /api/v1/*
 * route by reusing the same backend modules.
 *
 * Notes for Vercel:
 *  - Persistence is ephemeral (storage writes to the OS temp dir; see storage.js).
 *    The browser holds the authoritative live state, so this is fine for demos.
 *  - The Gemini API key is read from the GEMINI_API_KEY environment variable
 *    (set it in Vercel → Settings → Environment Variables). Never committed.
 */

const url = require('url');

const storage = require('../src/backend/storage');
const cvBridge = require('../src/backend/cvBridge');
const genAi = require('../src/backend/genAiService');

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=UTF-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(data));
}

// Vercel may pre-parse the JSON body into req.body; otherwise read the stream.
function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return Promise.resolve(JSON.parse(req.body || '{}')); }
      catch (e) { return Promise.resolve({}); }
    }
    return Promise.resolve(req.body);
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 15 * 1024 * 1024) { req.destroy(); resolve({}); }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const q = parsed.query || {};

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.end();
  }

  try {
    // GET /api/v1/telemetry
    if (req.method === 'GET' && pathname === '/api/v1/telemetry') {
      return sendJson(res, 200, { success: true, ...storage.getTelemetry() });
    }

    // GET /api/v1/health  (handy for confirming LLM wiring in the deploy)
    if (req.method === 'GET' && pathname === '/api/v1/health') {
      return sendJson(res, 200, { success: true, llmEnabled: genAi.isLlmEnabled() });
    }

    // POST /api/v1/scan/item
    if (req.method === 'POST' && pathname === '/api/v1/scan/item') {
      const body = await readBody(req);
      const result = storage.saveScanRecord(body);
      return sendJson(res, 200, { success: true, ...result });
    }

    // POST /api/v1/scan/image
    if (req.method === 'POST' && pathname === '/api/v1/scan/image') {
      const body = await readBody(req);
      const cvResult = await cvBridge.analyzeImageWithPython(body.image, body.filename || 'uploaded.jpg');
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
    }

    // POST /api/v1/facilities/purge
    if (req.method === 'POST' && pathname === '/api/v1/facilities/purge') {
      const body = await readBody(req);
      const result = storage.purgeFacilityBin(body.category);
      return sendJson(res, result.success ? 200 : 400, result);
    }

    // POST /api/v1/genai/advise
    if (req.method === 'POST' && pathname === '/api/v1/genai/advise') {
      const body = await readBody(req);
      const advice = await genAi.generateRecommendations(body);
      return sendJson(res, 200, { success: true, advice });
    }

    // POST /api/v1/genai/chat
    if (req.method === 'POST' && pathname === '/api/v1/genai/chat') {
      const body = await readBody(req);
      const reply = await genAi.processChatQuery(body.query);
      return sendJson(res, 200, { success: true, ...reply });
    }

    // GET /api/v1/logs
    if (req.method === 'GET' && pathname === '/api/v1/logs') {
      const limit = parseInt(q.limit, 10) || 50;
      const category = q.category || null;
      const logs = storage.getScans(limit, category);
      return sendJson(res, 200, { success: true, count: logs.length, logs });
    }

    // GET /api/v1/logs/export
    if (req.method === 'GET' && pathname === '/api/v1/logs/export') {
      const format = q.format === 'csv' ? 'csv' : 'json';
      const exportData = storage.exportScans(format);
      res.statusCode = 200;
      res.setHeader('Content-Type', exportData.mime);
      res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(exportData.data);
    }

    return sendJson(res, 404, { success: false, error: 'Not found' });
  } catch (err) {
    return sendJson(res, 500, { success: false, error: err.message });
  }
};
