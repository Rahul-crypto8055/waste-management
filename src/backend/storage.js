const fs = require('fs');
const path = require('path');
const os = require('os');

// On Vercel (and other serverless hosts) the project filesystem is read-only;
// only the OS temp dir is writable. Persistence there is ephemeral by design
// (resets on cold start) — the browser holds the authoritative live state.
// Locally, we persist to data/recycling_db.json as before.
const DB_PATH =
  process.env.DB_PATH ||
  (process.env.VERCEL
    ? path.join(os.tmpdir(), 'recycling_db.json')
    : path.join(__dirname, '..', '..', 'data', 'recycling_db.json'));

const DEFAULT_STATE = {
  initializedAt: new Date().toISOString(),
  telemetry: {
    totalScannedCount: 24,
    totalMassKg: 5.42,
    co2AvoidedKg: 12.85,
    landfillDiversionRate: 94.2,
    energySavedKwh: 34.6,
    waterSavedLiters: 182.0,
    contaminationAlerts: 0
  },
  facilities: {
    recyclable: { count: 12, massKg: 2.14, label: 'Materials Recovery Facility (MRF)', capacityPct: 62, maxCapacityKg: 5.0 },
    reusable: { count: 5, massKg: 1.65, label: 'Second-Life Reuse Hub', capacityPct: 45, maxCapacityKg: 4.0 },
    biodegradable: { count: 5, massKg: 1.25, label: 'Anaerobic Digester & Composting', capacityPct: 38, maxCapacityKg: 3.5 },
    hazardous: { count: 2, massKg: 0.38, label: 'Hazardous Remediation Vault', capacityPct: 24, maxCapacityKg: 2.0 }
  },
  scans: [
    {
      id: 'scan-init-1',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      timeFormatted: '10:01:14',
      name: 'PET Water Bottle (500ml)',
      category: 'recyclable',
      categoryLabel: 'Recyclable',
      material: 'Polyethylene Terephthalate (#1 PET)',
      massGrams: 28,
      co2SavedKg: 0.082,
      confidence: 0.96,
      facility: 'Materials Recovery Facility (MRF)',
      status: 'Diverted & Processed'
    },
    {
      id: 'scan-init-2',
      timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      timeFormatted: '10:02:05',
      name: 'Organic Banana Peel & Scraps',
      category: 'biodegradable',
      categoryLabel: 'Biodegradable',
      material: 'Potassium-Rich Lignocellulosic Biomass',
      massGrams: 65,
      co2SavedKg: 0.058,
      confidence: 0.98,
      facility: 'Anaerobic Digester & Composting',
      status: 'Diverted & Processed'
    },
    {
      id: 'scan-init-3',
      timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
      timeFormatted: '10:03:22',
      name: 'Canvas Tote Bag',
      category: 'reusable',
      categoryLabel: 'Reusable',
      material: '100% Woven Organic Cotton',
      massGrams: 120,
      co2SavedKg: 1.85,
      confidence: 0.95,
      facility: 'Second-Life Reuse Hub',
      status: 'Verified & Recirculated'
    },
    {
      id: 'scan-init-4',
      timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      timeFormatted: '10:04:10',
      name: 'Rechargeable Li-Ion Battery',
      category: 'hazardous',
      categoryLabel: 'Hazardous Waste',
      material: 'Lithium Cobalt Oxide & Electrolyte',
      massGrams: 48,
      co2SavedKg: 0.45,
      confidence: 0.99,
      facility: 'Hazardous Remediation Vault',
      status: '⚠️ Quarantined & Secured'
    }
  ]
};

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDb(DEFAULT_STATE);
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading recycling database, restoring default:', err);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function writeDb(data) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing to recycling database:', err);
    return false;
  }
}

function getTelemetry() {
  const db = readDb();
  return {
    telemetry: db.telemetry,
    facilities: db.facilities
  };
}

function saveScanRecord(scanData) {
  const db = readDb();
  const cat = scanData.category || 'recyclable';
  const itemMassKg = (scanData.massGrams || 50) / 1000;
  const itemCo2Kg = scanData.co2SavedKg || +(itemMassKg * 1.5).toFixed(3);

  // Update facility
  const facility = db.facilities[cat] || { count: 0, massKg: 0, capacityPct: 0, maxCapacityKg: 5.0 };
  const updatedMass = +(facility.massKg + itemMassKg).toFixed(2);
  const updatedCapacityPct = Math.min(100, Math.round((updatedMass / facility.maxCapacityKg) * 100));

  db.facilities[cat] = {
    ...facility,
    count: facility.count + 1,
    massKg: updatedMass,
    capacityPct: updatedCapacityPct
  };

  const isHazard = cat === 'hazardous';
  if (isHazard) {
    db.telemetry.contaminationAlerts = (db.telemetry.contaminationAlerts || 0) + 1;
  }

  // Update telemetry
  const newTotalCount = db.telemetry.totalScannedCount + 1;
  const newTotalMass = +(db.telemetry.totalMassKg + itemMassKg).toFixed(2);
  const newCo2 = +(db.telemetry.co2AvoidedKg + itemCo2Kg).toFixed(2);
  const newEnergy = +(db.telemetry.energySavedKwh + (itemCo2Kg * 2.8)).toFixed(1);
  const newWater = +(db.telemetry.waterSavedLiters + (itemCo2Kg * 14.5)).toFixed(1);

  const nonHazardousCount = newTotalCount - (isHazard ? db.facilities.hazardous.count : db.facilities.hazardous.count);
  const newDiversionRate = +(Math.min(99.4, Math.max(75, (nonHazardousCount / newTotalCount) * 98.5))).toFixed(1);

  db.telemetry = {
    ...db.telemetry,
    totalScannedCount: newTotalCount,
    totalMassKg: newTotalMass,
    co2AvoidedKg: newCo2,
    landfillDiversionRate: newDiversionRate,
    energySavedKwh: newEnergy,
    waterSavedLiters: newWater
  };

  // Add scan record
  const record = {
    id: scanData.id || `scan-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: scanData.timestamp || new Date().toISOString(),
    timeFormatted: new Date().toLocaleTimeString(),
    name: scanData.name || 'Unlabeled Material',
    category: cat,
    categoryLabel: scanData.categoryLabel || cat.toUpperCase(),
    material: scanData.material || 'Mixed Material',
    massGrams: scanData.massGrams || 50,
    co2SavedKg: itemCo2Kg,
    confidence: scanData.confidence || 0.95,
    facility: scanData.facility || db.facilities[cat]?.label || 'Sorting Chute',
    status: isHazard ? '⚠️ Quarantined & Secured' : 'Diverted & Processed'
  };

  db.scans.unshift(record);
  if (db.scans.length > 200) db.scans = db.scans.slice(0, 200);

  writeDb(db);
  return { record, telemetry: db.telemetry, facilities: db.facilities };
}

function purgeFacilityBin(category) {
  const db = readDb();
  if (db.facilities[category]) {
    db.facilities[category].massKg = 0;
    db.facilities[category].capacityPct = 0;
    writeDb(db);
    return { success: true, facilities: db.facilities };
  }
  return { success: false, error: 'Category not found' };
}

function getScans(limit = 50, category = null) {
  const db = readDb();
  let list = db.scans;
  if (category) {
    list = list.filter(s => s.category.toLowerCase() === category.toLowerCase());
  }
  return list.slice(0, limit);
}

function exportScans(format = 'json') {
  const db = readDb();
  if (format === 'csv') {
    let csv = 'ID,Timestamp,Item Name,Category,Material,Mass (g),CO2 Avoided (kg),Confidence,Facility,Status\n';
    db.scans.forEach(s => {
      csv += `"${s.id}","${s.timeFormatted}","${s.name}","${s.category}","${s.material}",${s.massGrams},${s.co2SavedKg},${s.confidence},"${s.facility}","${s.status}"\n`;
    });
    return { mime: 'text/csv', data: csv, filename: `recycling-audit-${Date.now()}.csv` };
  }

  const json = JSON.stringify({
    exportedAt: new Date().toISOString(),
    telemetry: db.telemetry,
    facilities: db.facilities,
    scans: db.scans
  }, null, 2);

  return { mime: 'application/json', data: json, filename: `recycling-audit-${Date.now()}.json` };
}

module.exports = {
  readDb,
  writeDb,
  getTelemetry,
  saveScanRecord,
  purgeFacilityBin,
  getScans,
  exportScans
};
