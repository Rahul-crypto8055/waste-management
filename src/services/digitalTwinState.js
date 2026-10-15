/**
 * Digital Twin State & Simulation Engine
 * Tracks material flow through circular economy sorting facilities,
 * calculates real-time telemetry (CO2 offset, landfill diversion rate, water/energy saved),
 * tracks bin fill capacities and contamination alerts.
 */

export const INITIAL_DIGITAL_TWIN = {
  activeSince: new Date().toLocaleTimeString(),
  totalScannedCount: 24,
  totalMassKg: 5.42,
  co2AvoidedKg: 12.85,
  landfillDiversionRate: 94.2, // percentage
  energySavedKwh: 34.6,
  waterSavedLiters: 182.0,
  facilityMetrics: {
    recyclable: { count: 12, massKg: 2.14, label: 'Materials Recovery Facility (MRF)', capacityPct: 62, maxCapacityKg: 5.0 },
    reusable: { count: 5, massKg: 1.65, label: 'Second-Life Reuse Hub', capacityPct: 45, maxCapacityKg: 4.0 },
    biodegradable: { count: 5, massKg: 1.25, label: 'Anaerobic Digester & Composting', capacityPct: 38, maxCapacityKg: 3.5 },
    hazardous: { count: 2, massKg: 0.38, label: 'Hazardous Remediation Vault', capacityPct: 24, maxCapacityKg: 2.0 }
  },
  contaminationAlerts: 0,
  recentLogs: [
    { id: 1, time: '10:01:14', item: 'PET Water Bottle', category: 'recyclable', dest: 'MRF Optical Chute', status: 'Sorted' },
    { id: 2, time: '10:02:05', item: 'Organic Banana Peel', category: 'biodegradable', dest: 'Compost Digestor', status: 'Sorted' },
    { id: 3, time: '10:03:22', item: 'Canvas Tote Bag', category: 'reusable', dest: 'Circular Depot', status: 'Verified' },
    { id: 4, time: '10:04:10', item: 'Li-Ion Battery Pack', category: 'hazardous', dest: 'Hazard Vault', status: 'Quarantined & Secured' }
  ]
};

/**
 * Updates digital twin telemetry when a new item is detected and sorted
 */
export function recordItemInDigitalTwin(prevState, newItem) {
  const cat = newItem.category || 'recyclable';
  const itemMassKg = (newItem.massGrams || 50) / 1000;
  const itemCo2Kg = newItem.co2SavedKg || (itemMassKg * 1.5);

  const prevFacility = prevState.facilityMetrics[cat] || { count: 0, massKg: 0, capacityPct: 0, maxCapacityKg: 5.0 };
  const updatedMass = +(prevFacility.massKg + itemMassKg).toFixed(2);
  const updatedCapacityPct = Math.min(100, Math.round((updatedMass / prevFacility.maxCapacityKg) * 100));

  const updatedFacility = {
    ...prevFacility,
    count: prevFacility.count + 1,
    massKg: updatedMass,
    capacityPct: updatedCapacityPct,
    activeChute: true
  };

  const isHazard = cat === 'hazardous';
  const newContamAlerts = isHazard ? prevState.contaminationAlerts + 1 : prevState.contaminationAlerts;

  const newTotalCount = prevState.totalScannedCount + 1;
  const newTotalMass = +(prevState.totalMassKg + itemMassKg).toFixed(2);
  const newCo2 = +(prevState.co2AvoidedKg + itemCo2Kg).toFixed(2);
  
  // Resource conversions
  const newEnergy = +(prevState.energySavedKwh + (itemCo2Kg * 2.8)).toFixed(1);
  const newWater = +(prevState.waterSavedLiters + (itemCo2Kg * 14.5)).toFixed(1);

  // Recalculate landfill diversion rate
  const nonHazardousCount = newTotalCount - (isHazard ? updatedFacility.count : prevState.facilityMetrics.hazardous.count);
  const newDiversionRate = +(Math.min(99.4, Math.max(75, (nonHazardousCount / newTotalCount) * 98.5))).toFixed(1);

  const newLog = {
    id: Date.now(),
    time: new Date().toLocaleTimeString(),
    item: newItem.name || 'Scanned Material',
    category: cat,
    dest: updatedFacility.label || 'Sorting Chute',
    status: isHazard ? '⚠️ Quarantined & Secured' : 'Diverted & Processed'
  };

  return {
    ...prevState,
    totalScannedCount: newTotalCount,
    totalMassKg: newTotalMass,
    co2AvoidedKg: newCo2,
    landfillDiversionRate: newDiversionRate,
    energySavedKwh: newEnergy,
    waterSavedLiters: newWater,
    contaminationAlerts: newContamAlerts,
    facilityMetrics: {
      ...prevState.facilityMetrics,
      [cat]: updatedFacility
    },
    recentLogs: [newLog, ...prevState.recentLogs.slice(0, 24)]
  };
}

/**
 * Empty/purge a specific bin in the Digital Twin facility
 */
export function purgeBinInDigitalTwin(prevState, category) {
  if (!prevState.facilityMetrics[category]) return prevState;

  return {
    ...prevState,
    facilityMetrics: {
      ...prevState.facilityMetrics,
      [category]: {
        ...prevState.facilityMetrics[category],
        massKg: 0,
        capacityPct: 0
      }
    }
  };
}
