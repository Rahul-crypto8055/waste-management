const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Resolve the Python executable portably:
//   1. Honor an explicit override via the PYTHON_PATH env var.
//   2. Otherwise use the launcher/command available on PATH
//      ("py" on Windows, "python3"/"python" elsewhere).
// If none works, analyzeImageWithPython() degrades gracefully to the
// built-in heuristic fallback, so the app never hard-fails.
const PYTHON_PATH =
  process.env.PYTHON_PATH ||
  (process.platform === 'win32' ? 'py' : 'python3');
const SCRIPT_PATH = path.join(__dirname, '..', '..', 'cv_engine.py');
// On Vercel the project dir is read-only; only the OS temp dir is writable.
// (On Vercel the Python path is skipped entirely, so this is just a safe default.)
const TEMP_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'temp_scans')
  : path.join(__dirname, '..', '..', 'data', 'temp_scans');

// Ensure temp dir exists — never throw at module load (serverless FS is read-only),
// otherwise requiring this module would crash the whole function.
try {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
} catch (e) {
  /* ignore: on Vercel the image path short-circuits before using TEMP_DIR */
}

/**
 * Executes cv_engine.py on an image buffer or file path
 */
async function analyzeImageWithPython(imageBase64OrBuffer, originalName = 'upload.jpg') {
  // Serverless hosts (Vercel) can't spawn a Python subprocess. The real
  // computer vision runs client-side (TensorFlow.js); this backend path is a
  // convenience, so on Vercel we skip straight to the heuristic fallback.
  if (process.env.VERCEL) {
    return Promise.resolve(fallbackAnalysis(originalName));
  }

  return new Promise((resolve) => {
    let tempFile = null;

    try {
      if (imageBase64OrBuffer) {
        let buffer;
        if (typeof imageBase64OrBuffer === 'string') {
          // Remove data:image/...;base64, prefix if present
          const base64Data = imageBase64OrBuffer.replace(/^data:image\/\w+;base64,/, '');
          buffer = Buffer.from(base64Data, 'base64');
        } else {
          buffer = imageBase64OrBuffer;
        }

        tempFile = path.join(TEMP_DIR, `scan-${Date.now()}-${originalName}`);
        fs.writeFileSync(tempFile, buffer);
      }

      const args = [SCRIPT_PATH];
      if (tempFile) args.push(tempFile);

      // Execute Python CV engine
      const pyProcess = spawn(PYTHON_PATH, args);

      let stdout = '';
      let stderr = '';

      pyProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pyProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        pyProcess.kill();
        resolve(fallbackAnalysis(originalName));
      }, 5000);

      pyProcess.on('close', (code) => {
        clearTimeout(timeout);
        // Clean up temp file
        if (tempFile && fs.existsSync(tempFile)) {
          try { fs.unlinkSync(tempFile); } catch (e) {}
        }

        if (code === 0 && stdout) {
          try {
            // Find JSON block in python output
            const jsonStart = stdout.indexOf('{');
            const jsonEnd = stdout.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
              const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
              const parsed = JSON.parse(jsonStr);
              return resolve({
                success: true,
                source: 'python_cv_engine',
                data: parsed
              });
            }
          } catch (err) {
            console.warn('Failed to parse Python JSON output:', err);
          }
        }
        resolve(fallbackAnalysis(originalName));
      });

      pyProcess.on('error', (err) => {
        console.warn('Python process execution error:', err);
        if (tempFile && fs.existsSync(tempFile)) {
          try { fs.unlinkSync(tempFile); } catch (e) {}
        }
        resolve(fallbackAnalysis(originalName));
      });
    } catch (err) {
      console.error('cvBridge error:', err);
      if (tempFile && fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch (e) {}
      }
      resolve(fallbackAnalysis(originalName));
    }
  });
}

function fallbackAnalysis(filename = 'item') {
  const lower = (filename || '').toLowerCase();
  let category = 'recyclable';
  let name = 'Identified Container';
  let material = 'Polyethylene Terephthalate (#1 PET)';
  let massGrams = 28;
  let co2SavedKg = 0.082;
  let facility = 'Materials Recovery Facility (MRF)';

  if (lower.includes('banana') || lower.includes('apple') || lower.includes('food') || lower.includes('peel')) {
    category = 'biodegradable';
    name = 'Organic Biomass Residue';
    material = 'Lignocellulosic Plant Fiber';
    massGrams = 65;
    co2SavedKg = 0.058;
    facility = 'Anaerobic Digester & Composting';
  } else if (lower.includes('bag') || lower.includes('tote') || lower.includes('tumbler') || lower.includes('flask')) {
    category = 'reusable';
    name = 'Reusable Product';
    material = 'Durable Multi-Cycle Material';
    massGrams = 180;
    co2SavedKg = 2.4;
    facility = 'Second-Life Reuse Hub';
  } else if (lower.includes('battery') || lower.includes('cell') || lower.includes('phone') || lower.includes('chemical')) {
    category = 'hazardous';
    name = 'Hazardous E-Waste Material';
    material = 'Heavy Metals & Corrosive Electrolyte';
    massGrams = 50;
    co2SavedKg = 0.45;
    facility = 'Hazardous Remediation Vault';
  }

  return {
    success: true,
    source: 'backend_heuristic_fallback',
    data: {
      timestamp: new Date().toISOString(),
      item_name: name,
      category,
      category_title: category.toUpperCase(),
      confidence: 0.94,
      material_composition: material,
      mass_grams: massGrams,
      co2_avoided_kg: co2SavedKg,
      decomposition_years: category === 'biodegradable' ? 0.05 : (category === 'recyclable' ? 450 : 1000),
      target_facility: facility,
      handling_protocol: 'Properly sort into assigned pneumatic chute.',
      digital_twin_packet: {
        routed_chute: `Chute-${category.toUpperCase()}`,
        priority: category === 'hazardous' ? 'HIGH' : 'NORMAL',
        audit_code: `SORT-${Date.now()}`
      }
    }
  };
}

module.exports = {
  analyzeImageWithPython
};
