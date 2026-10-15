import { SAMPLE_ITEMS, CATEGORY_METRICS } from './data/sampleItems.js';
import { classifyWasteItem, classifyByKeyword, initNeuralVisionModel } from './services/classifier.js';
import { INITIAL_DIGITAL_TWIN, recordItemInDigitalTwin, purgeBinInDigitalTwin } from './services/digitalTwinState.js';
import * as api from './services/apiClient.js';

// Application State
let state = {
  digitalTwin: { ...INITIAL_DIGITAL_TWIN },
  currentItem: SAMPLE_ITEMS[0],
  isCameraActive: false,
  cameraStream: null,
  isContinuousScanActive: false,
  continuousScanInterval: null,
  isSimulatingStream: false,
  simulationInterval: null,
  isVoiceEnabled: true,
  isAudioMuted: false,
  modelStatus: 'Initializing Model...',
  chatHistory: [
    {
      sender: 'ai',
      text: "👋 Welcome to the **Smart Recycling Assistant**! Powered by our full-stack Computer Vision, Digital Twin, and Generative AI backend. Scan an item using your live camera, upload an image, or pick a sample from the test library."
    }
  ]
};

// DOM References
const videoEl = document.getElementById('webcam-video');
const overlayCanvas = document.getElementById('overlay-canvas');
const fileInput = document.getElementById('file-upload');
const dropZone = document.getElementById('drop-zone');
const previewImage = document.getElementById('preview-image');
const cameraPlaceholder = document.getElementById('camera-placeholder');
const modelStatusEl = document.getElementById('model-status-indicator');

// Telemetry Elements
const elTotalScanned = document.getElementById('metric-total-scanned');
const elTotalMass = document.getElementById('metric-total-mass');
const elCo2Avoided = document.getElementById('metric-co2-avoided');
const elDiversionRate = document.getElementById('metric-diversion-rate');
const elWaterSaved = document.getElementById('metric-water-saved');
const elEnergySaved = document.getElementById('metric-energy-saved');

// Detected Item Info Elements
const elItemName = document.getElementById('detected-item-name');
const elItemCategoryBadge = document.getElementById('detected-item-category-badge');
const elItemConfidence = document.getElementById('detected-item-confidence');
const elItemMaterial = document.getElementById('detected-item-material');
const elItemMass = document.getElementById('detected-item-mass');
const elItemCo2 = document.getElementById('detected-item-co2');
const elItemDecomp = document.getElementById('detected-item-decomp');
const elItemFacility = document.getElementById('detected-item-facility');
const elItemPrepList = document.getElementById('detected-item-prep-list');
const elItemUpcycleList = document.getElementById('detected-item-upcycle-list');

// Category Counters & Fill Bars
const elCatRecyclable = document.getElementById('count-recyclable');
const elCatReusable = document.getElementById('count-reusable');
const elCatBiodegradable = document.getElementById('count-biodegradable');
const elCatHazardous = document.getElementById('count-hazardous');

const elBarRecyclable = document.getElementById('bar-recyclable');
const elBarReusable = document.getElementById('bar-reusable');
const elBarBiodegradable = document.getElementById('bar-biodegradable');
const elBarHazardous = document.getElementById('bar-hazardous');

// Audit Log Table Body
const elAuditLogTable = document.getElementById('audit-log-body');

// GenAI Chat Elements
const elChatMessages = document.getElementById('chat-messages');
const elChatInput = document.getElementById('chat-input');
const elChatSendBtn = document.getElementById('chat-send-btn');

// Audio Context for UI Synthesizer Sound Effects
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playSound(type) {
  if (state.isAudioMuted) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'sort') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'hazard') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(240, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {}
}

function speakVoice(text) {
  if (!state.isVoiceEnabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis error:', e);
  }
}

/**
 * Initialize Application & Synchronize with Backend
 */
export async function initApp() {
  renderSampleCards();
  renderCurrentItem(state.currentItem);
  setupEventListeners();
  initConveyorAnimation();
  drawBoundingBox(state.currentItem.bbox || { x: 25, y: 20, width: 50, height: 60 });

  // Sync initial telemetry from Backend REST API
  try {
    const backendData = await api.fetchTelemetry();
    if (backendData && backendData.telemetry) {
      state.digitalTwin.totalScannedCount = backendData.telemetry.totalScannedCount;
      state.digitalTwin.totalMassKg = backendData.telemetry.totalMassKg;
      state.digitalTwin.co2AvoidedKg = backendData.telemetry.co2AvoidedKg;
      state.digitalTwin.landfillDiversionRate = backendData.telemetry.landfillDiversionRate;
      state.digitalTwin.energySavedKwh = backendData.telemetry.energySavedKwh;
      state.digitalTwin.waterSavedLiters = backendData.telemetry.waterSavedLiters;
      if (backendData.facilities) {
        state.digitalTwin.facilityMetrics = backendData.facilities;
      }
    }

    const logData = await api.fetchAuditLogs(20);
    if (logData && logData.logs && logData.logs.length) {
      if (elAuditLogTable) elAuditLogTable.innerHTML = '';
      logData.logs.forEach(l => {
        addAuditLogRow({
          time: l.timeFormatted || l.time,
          item: l.name || l.item,
          category: l.category,
          dest: l.facility || l.dest,
          status: l.status
        });
      });
    }
  } catch (e) {
    console.warn('Initial backend sync notice:', e);
  }

  updateTelemetryUI();

  // Initialize TensorFlow.js Neural Vision in background
  initNeuralVisionModel((status) => {
    state.modelStatus = status;
    if (modelStatusEl) modelStatusEl.textContent = status;
  });
}

/**
 * Render Sample Cards in the Test Library
 */
function renderSampleCards() {
  const container = document.getElementById('sample-library-grid');
  if (!container) return;

  container.innerHTML = SAMPLE_ITEMS.map(item => {
    let badgeBg = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    if (item.category === 'reusable') badgeBg = 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
    if (item.category === 'biodegradable') badgeBg = 'bg-lime-500/20 text-lime-400 border-lime-500/40';
    if (item.category === 'hazardous') badgeBg = 'bg-rose-500/20 text-rose-400 border-rose-500/40';

    return `
      <div 
        data-item-id="${item.id}"
        class="sample-card group cursor-pointer p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/60 hover:bg-slate-800/80 transition-all duration-200 transform hover:-translate-y-0.5 shadow-md hover:shadow-cyan-500/10"
      >
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeBg}">
            ${item.categoryLabel}
          </span>
          <span class="text-[11px] font-mono text-slate-400">${(item.confidence * 100).toFixed(0)}%</span>
        </div>
        <div class="font-semibold text-xs text-slate-200 group-hover:text-cyan-300 transition-colors truncate">
          ${item.name}
        </div>
        <div class="text-[11px] text-slate-400 truncate mt-0.5">
          ${item.material}
        </div>
        <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400">
          <span>⚖️ ${item.massGrams}g</span>
          <span class="text-emerald-400 font-medium">🌱 -${item.co2SavedKg}kg CO₂</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.sample-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-item-id');
      const item = SAMPLE_ITEMS.find(i => i.id === id);
      if (item) {
        processDetectedItem(item, 'sample');
      }
    });
  });
}

/**
 * Handle new detected item: classify, persist in Backend, update Digital Twin & trigger flow animation
 */
export async function processDetectedItem(rawInput, source = 'scan') {
  if (cameraPlaceholder && !state.isCameraActive) cameraPlaceholder.classList.add('hidden');

  const classified = await classifyWasteItem(rawInput);
  state.currentItem = classified;

  // Sound & Voice announcements
  if (classified.category === 'hazardous') {
    playSound('hazard');
    speakVoice(`Warning: Hazardous material detected. Quarantining ${classified.name} into vault.`);
  } else {
    playSound('sort');
    speakVoice(`${classified.categoryLabel} detected. Routing ${classified.name} to ${classified.facility.split(' ')[0]}.`);
  }

  // Update local Digital Twin state
  state.digitalTwin = recordItemInDigitalTwin(state.digitalTwin, classified);

  // Persist asynchronously in Backend Database
  api.postScanItem(classified).then(res => {
    if (res && res.telemetry) {
      // Sync authoritative backend telemetry
      state.digitalTwin.totalScannedCount = res.telemetry.totalScannedCount;
      state.digitalTwin.totalMassKg = res.telemetry.totalMassKg;
      state.digitalTwin.co2AvoidedKg = res.telemetry.co2AvoidedKg;
      state.digitalTwin.landfillDiversionRate = res.telemetry.landfillDiversionRate;
      updateTelemetryUI();
    }
  }).catch(e => console.warn('Backend item persist error:', e));

  // Update UI components
  renderCurrentItem(classified);
  updateTelemetryUI();
  addAuditLogRow(state.digitalTwin.recentLogs[0]);

  // Dispatch item on Digital Twin animated conveyor
  spawnConveyorItem(classified);

  // Contextual GenAI advice
  if (source !== 'continuous') {
    addGenAIContextualAdvice(classified);
  }
}

function renderCurrentItem(item) {
  if (!item) return;

  elItemName.textContent = item.name;
  elItemConfidence.textContent = `${(item.confidence * 100).toFixed(1)}%`;
  elItemMaterial.textContent = item.material;
  elItemMass.textContent = `${item.massGrams} g`;
  elItemCo2.textContent = `-${item.co2SavedKg} kg`;
  elItemDecomp.textContent = item.decompositionYears > 1 ? `${item.decompositionYears} years` : `${Math.round(item.decompositionYears * 12)} months`;
  elItemFacility.textContent = item.facility;

  let badgeClasses = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
  if (item.category === 'reusable') badgeClasses = 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
  if (item.category === 'biodegradable') badgeClasses = 'bg-lime-500/20 text-lime-400 border-lime-500/50';
  if (item.category === 'hazardous') badgeClasses = 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse';

  elItemCategoryBadge.className = `text-xs font-semibold px-3 py-1 rounded-full border ${badgeClasses}`;
  elItemCategoryBadge.textContent = item.categoryLabel || item.category.toUpperCase();

  if (elItemPrepList) {
    elItemPrepList.innerHTML = (item.preparation || []).map(step => `
      <li class="flex items-start gap-2 text-xs text-slate-300">
        <span class="text-cyan-400 mt-0.5">✓</span>
        <span>${step}</span>
      </li>
    `).join('');
  }

  if (elItemUpcycleList) {
    elItemUpcycleList.innerHTML = (item.upcycleIdeas || []).map(idea => `
      <li class="flex items-start gap-2 text-xs text-slate-300">
        <span class="text-amber-400 mt-0.5">💡</span>
        <span>${idea}</span>
      </li>
    `).join('');
  }

  if (item.bbox) {
    drawBoundingBox(item.bbox, item);
  }
}

function drawBoundingBox(bbox, item = state.currentItem) {
  if (!overlayCanvas) return;
  const ctx = overlayCanvas.getContext('2d');
  const w = overlayCanvas.width = overlayCanvas.parentElement.clientWidth || 400;
  const h = overlayCanvas.height = overlayCanvas.parentElement.clientHeight || 300;

  ctx.clearRect(0, 0, w, h);

  const bx = (bbox.x / 100) * w;
  const by = (bbox.y / 100) * h;
  const bw = (bbox.width / 100) * w;
  const bh = (bbox.height / 100) * h;

  let strokeColor = '#10b981';
  if (item.category === 'reusable') strokeColor = '#06b6d4';
  if (item.category === 'biodegradable') strokeColor = '#84cc16';
  if (item.category === 'hazardous') strokeColor = '#f43f5e';

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.5;
  const cornerSize = Math.min(20, bw / 4, bh / 4);

  ctx.beginPath();
  ctx.moveTo(bx, by + cornerSize);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + cornerSize, by);

  ctx.moveTo(bx + bw - cornerSize, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw, by + cornerSize);

  ctx.moveTo(bx + bw, by + bh - cornerSize);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx + bw - cornerSize, by + bh);

  ctx.moveTo(bx + cornerSize, by + bh);
  ctx.lineTo(bx, by + bh);
  ctx.lineTo(bx, by + bh - cornerSize);
  ctx.stroke();

  ctx.fillStyle = `${strokeColor}15`;
  ctx.fillRect(bx, by, bw, bh);

  ctx.fillStyle = strokeColor;
  ctx.fillRect(bx, by - 24, Math.min(220, bw + 20), 22);

  ctx.fillStyle = '#080d14';
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  const labelText = `${item.category.toUpperCase()} [${Math.round(item.confidence * 100)}%]`;
  ctx.fillText(labelText, bx + 6, by - 8);
}

function updateTelemetryUI() {
  const dt = state.digitalTwin;
  elTotalScanned.textContent = dt.totalScannedCount;
  elTotalMass.textContent = `${dt.totalMassKg.toFixed(2)} kg`;
  elCo2Avoided.textContent = `${dt.co2AvoidedKg.toFixed(2)} kg`;
  elDiversionRate.textContent = `${dt.landfillDiversionRate}%`;
  elWaterSaved.textContent = `${dt.waterSavedLiters.toFixed(0)} L`;
  elEnergySaved.textContent = `${dt.energySavedKwh.toFixed(1)} kWh`;

  elCatRecyclable.textContent = dt.facilityMetrics.recyclable.count;
  elCatReusable.textContent = dt.facilityMetrics.reusable.count;
  elCatBiodegradable.textContent = dt.facilityMetrics.biodegradable.count;
  elCatHazardous.textContent = dt.facilityMetrics.hazardous.count;

  if (elBarRecyclable) elBarRecyclable.style.width = `${dt.facilityMetrics.recyclable.capacityPct}%`;
  if (elBarReusable) elBarReusable.style.width = `${dt.facilityMetrics.reusable.capacityPct}%`;
  if (elBarBiodegradable) elBarBiodegradable.style.width = `${dt.facilityMetrics.biodegradable.capacityPct}%`;
  if (elBarHazardous) elBarHazardous.style.width = `${dt.facilityMetrics.hazardous.capacityPct}%`;
}

function addAuditLogRow(logEntry) {
  if (!elAuditLogTable || !logEntry) return;

  const row = document.createElement('tr');
  row.className = 'border-b border-slate-800/80 hover:bg-slate-800/40 text-xs transition-colors';

  let badgeBg = 'bg-emerald-500/20 text-emerald-400';
  if (logEntry.category === 'reusable') badgeBg = 'bg-cyan-500/20 text-cyan-400';
  if (logEntry.category === 'biodegradable') badgeBg = 'bg-lime-500/20 text-lime-400';
  if (logEntry.category === 'hazardous') badgeBg = 'bg-rose-500/20 text-rose-400 font-bold';

  row.innerHTML = `
    <td class="py-2 px-3 text-slate-400 font-mono">${logEntry.time}</td>
    <td class="py-2 px-3 font-medium text-slate-200">${logEntry.item}</td>
    <td class="py-2 px-3">
      <span class="px-2 py-0.5 rounded-full ${badgeBg}">
        ${logEntry.category}
      </span>
    </td>
    <td class="py-2 px-3 text-slate-400">${logEntry.dest}</td>
    <td class="py-2 px-3 text-emerald-400 font-medium">${logEntry.status}</td>
  `;

  elAuditLogTable.insertBefore(row, elAuditLogTable.firstChild);

  while (elAuditLogTable.children.length > 20) {
    elAuditLogTable.removeChild(elAuditLogTable.lastChild);
  }
}

let conveyorItems = [];
const dtCanvas = document.getElementById('digital-twin-canvas');

function initConveyorAnimation() {
  if (!dtCanvas) return;
  const ctx = dtCanvas.getContext('2d');

  function resizeCanvas() {
    dtCanvas.width = dtCanvas.parentElement.clientWidth || 600;
    dtCanvas.height = dtCanvas.parentElement.clientHeight || 260;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function animate() {
    drawDigitalTwinSchematic(ctx, dtCanvas.width, dtCanvas.height);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

function spawnConveyorItem(item) {
  if (!dtCanvas) return;
  conveyorItems.push({
    name: item.name,
    category: item.category,
    color: CATEGORY_METRICS[item.category]?.color || '#10b981',
    progress: 0,
    speed: 0.012 + Math.random() * 0.006,
    id: Date.now()
  });
}

function drawDigitalTwinSchematic(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);

  const startX = 40;
  const forkX = width * 0.45;
  const endX = width - 40;
  const centerY = height * 0.5;

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX, centerY);
  ctx.lineTo(forkX, centerY);
  ctx.stroke();

  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(forkX, centerY, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
  ctx.beginPath();
  ctx.arc(forkX, centerY, 28 + Math.sin(Date.now() / 200) * 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CV SCAN', forkX, centerY + 3);

  const chutes = [
    { cat: 'recyclable', y: height * 0.18, color: '#10b981', label: '1. MRF (Recycle)' },
    { cat: 'reusable', y: height * 0.38, color: '#06b6d4', label: '2. Reuse Depot' },
    { cat: 'biodegradable', y: height * 0.62, color: '#84cc16', label: '3. Composter' },
    { cat: 'hazardous', y: height * 0.82, color: '#f43f5e', label: '4. Hazard Vault' }
  ];

  chutes.forEach(chute => {
    ctx.strokeStyle = `${chute.color}40`;
    ctx.lineWidth = 4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(forkX, centerY);
    ctx.bezierCurveTo(forkX + 50, centerY, width * 0.7, chute.y, endX - 70, chute.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = chute.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(endX - 70, chute.y - 12, 65, 24, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = chute.color;
    ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(chute.label, endX - 38, chute.y + 3);
  });

  for (let i = conveyorItems.length - 1; i >= 0; i--) {
    const item = conveyorItems[i];
    item.progress += item.speed;

    let posX, posY;
    if (item.progress <= 0.45) {
      const t = item.progress / 0.45;
      posX = startX + t * (forkX - startX);
      posY = centerY;
    } else {
      const t = (item.progress - 0.45) / 0.55;
      const targetChute = chutes.find(c => c.cat === item.category) || chutes[0];
      posX = forkX + t * (endX - 70 - forkX);
      posY = centerY + t * (targetChute.y - centerY);
    }

    ctx.fillStyle = item.color;
    ctx.shadowColor = item.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(posX, posY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (item.progress >= 1.0) {
      conveyorItems.splice(i, 1);
    }
  }
}

async function addGenAIContextualAdvice(item) {
  try {
    const backendAdvice = await api.postGenAiAdvice(item);
    if (backendAdvice && backendAdvice.advice) {
      const adv = backendAdvice.advice;
      const adviceText = `
🔎 **Detected:** ${adv.itemName} (${(adv.category || '').toUpperCase()})
- **Routed Facility:** ${adv.targetFacility}
- **Primary Action:** ${adv.handlingChecklist?.[0] || 'Clean and prep item'}
- **Circular Idea:** ${adv.upcyclingProjects?.[0] || 'Explore zero-waste alternatives'}
- **Carbon Impact:** Avoids ~${adv.environmentalImpact?.co2AvoidedKg} kg CO₂e
      `.trim();
      return appendChatMessage('ai', adviceText);
    }
  } catch (e) {}

  const fallback = `
🔎 **Detected:** ${item.name} (${item.categoryLabel})
- **Material Composition:** ${item.material}
- **Optimal Facility:** ${item.facility}
- **Recommended Action:** ${item.preparation?.[0] || 'Clean and prep item for chute'}
- **Circular Idea:** ${item.upcycleIdeas?.[0] || 'Explore zero-waste alternatives'}
  `.trim();

  appendChatMessage('ai', fallback);
}

function appendChatMessage(sender, text) {
  state.chatHistory.push({ sender, text });
  if (!elChatMessages) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'} my-1.5`;

  const bubble = document.createElement('div');
  bubble.className = sender === 'user'
    ? 'bg-cyan-600 text-white rounded-2xl rounded-tr-none px-4 py-2 max-w-[85%] text-xs shadow'
    : 'bg-slate-800 text-slate-200 border border-slate-700/70 rounded-2xl rounded-tl-none px-4 py-2 max-w-[85%] text-xs shadow leading-relaxed';

  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');

  bubble.innerHTML = formatted;
  msgDiv.appendChild(bubble);

  const timeSpan = document.createElement('span');
  timeSpan.className = 'text-[10px] text-slate-500 mt-1 px-1';
  timeSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  msgDiv.appendChild(timeSpan);

  elChatMessages.appendChild(msgDiv);
  elChatMessages.scrollTop = elChatMessages.scrollHeight;
}

async function handleUserChatQuery(query) {
  if (!query || !query.trim()) return;
  const q = query.trim();
  appendChatMessage('user', q);
  elChatInput.value = '';

  try {
    const res = await api.postGenAiChat(q);
    if (res && res.response) {
      return appendChatMessage('ai', res.response);
    }
  } catch (e) {}

  // Fallback
  setTimeout(() => {
    const match = classifyByKeyword(q);
    const reply = `🤖 **Circular Advice for "${q}":**\nThis typically classifies under **${match.categoryLabel}**. \n- **Key Material:** ${match.material}\n- **Standard Preparation:** ${match.preparation?.[0] || 'Keep clean and sort in proper chute'}\n- **Impact:** Diverting this item reduces approximately ${match.co2SavedKg}kg of CO₂ equivalents.`;
    appendChatMessage('ai', reply);
  }, 350);
}

function setupEventListeners() {
  const toggleCamBtn = document.getElementById('btn-toggle-camera');
  if (toggleCamBtn) {
    toggleCamBtn.addEventListener('click', toggleCamera);
  }

  const captureBtn = document.getElementById('btn-capture-scan');
  if (captureBtn) {
    captureBtn.addEventListener('click', captureCameraSnapshot);
  }

  const voiceToggleBtn = document.getElementById('btn-toggle-voice');
  if (voiceToggleBtn) {
    voiceToggleBtn.addEventListener('click', () => {
      state.isVoiceEnabled = !state.isVoiceEnabled;
      voiceToggleBtn.innerHTML = state.isVoiceEnabled ? '🔊 Voice: ON' : '🔇 Voice: OFF';
      voiceToggleBtn.classList.toggle('text-cyan-400', state.isVoiceEnabled);
      voiceToggleBtn.classList.toggle('text-slate-500', !state.isVoiceEnabled);
      if (state.isVoiceEnabled) speakVoice('Voice feedback enabled.');
    });
  }

  const liveScanToggleBtn = document.getElementById('btn-toggle-continuous-scan');
  if (liveScanToggleBtn) {
    liveScanToggleBtn.addEventListener('click', () => {
      if (!state.isCameraActive) {
        alert('Please start the webcam first before enabling continuous AI scanning.');
        return;
      }
      state.isContinuousScanActive = !state.isContinuousScanActive;
      if (state.isContinuousScanActive) {
        liveScanToggleBtn.textContent = '⏹ Stop Live Auto-Scan';
        liveScanToggleBtn.classList.replace('bg-slate-800', 'bg-cyan-900/60');
        liveScanToggleBtn.classList.replace('text-slate-300', 'text-cyan-300');
        state.continuousScanInterval = setInterval(() => {
          if (state.isCameraActive && videoEl) {
            processDetectedItem(videoEl, 'continuous');
          }
        }, 800);
      } else {
        liveScanToggleBtn.textContent = '🔄 Live Auto-Scan';
        liveScanToggleBtn.classList.replace('bg-cyan-900/60', 'bg-slate-800');
        liveScanToggleBtn.classList.replace('text-cyan-300', 'text-slate-300');
        clearInterval(state.continuousScanInterval);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', handleFileUpload);
  }

  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-cyan-400', 'bg-cyan-950/20');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-cyan-400', 'bg-cyan-950/20');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-cyan-400', 'bg-cyan-950/20');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processUploadedFile(e.dataTransfer.files[0]);
      }
    });
  }

  const simToggleBtn = document.getElementById('btn-toggle-stream-sim');
  if (simToggleBtn) {
    simToggleBtn.addEventListener('click', () => {
      state.isSimulatingStream = !state.isSimulatingStream;
      if (state.isSimulatingStream) {
        simToggleBtn.textContent = '⏹ Stop Stream Simulation';
        simToggleBtn.classList.replace('bg-slate-800', 'bg-rose-900/50');
        simToggleBtn.classList.replace('text-cyan-400', 'text-rose-300');
        state.simulationInterval = setInterval(() => {
          const randomItem = SAMPLE_ITEMS[Math.floor(Math.random() * SAMPLE_ITEMS.length)];
          processDetectedItem(randomItem, 'simulated');
        }, 2000);
      } else {
        simToggleBtn.textContent = '⚡ Simulate Live Conveyor Stream';
        simToggleBtn.classList.replace('bg-rose-900/50', 'bg-slate-800');
        simToggleBtn.classList.replace('text-rose-300', 'text-cyan-400');
        clearInterval(state.simulationInterval);
      }
    });
  }

  document.querySelectorAll('.btn-purge-bin').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const cat = btn.getAttribute('data-bin-cat');
      if (cat) {
        state.digitalTwin = purgeBinInDigitalTwin(state.digitalTwin, cat);
        updateTelemetryUI();
        speakVoice(`${cat.toUpperCase()} bin emptied and returned to service.`);
        // Notify backend
        api.purgeFacilityBinApi(cat).catch(err => console.warn('Backend purge bin error:', err));
      }
    });
  });

  if (elChatSendBtn && elChatInput) {
    elChatSendBtn.addEventListener('click', () => handleUserChatQuery(elChatInput.value));
    elChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleUserChatQuery(elChatInput.value);
    });
  }

  document.querySelectorAll('.preset-prompt-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const promptText = pill.getAttribute('data-prompt');
      if (promptText) {
        handleUserChatQuery(promptText);
      }
    });
  });

  const btnExportCsv = document.getElementById('btn-export-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => exportAuditData('csv'));
  }

  const btnExportJson = document.getElementById('btn-export-json');
  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => exportAuditData('json'));
  }
}

/**
 * Export the audit trail + telemetry directly from live browser state.
 * This works identically on local and on serverless (Vercel) deployments,
 * and always matches exactly what the user sees on screen.
 */
function exportAuditData(format) {
  const dt = state.digitalTwin;
  const logs = dt.recentLogs || [];
  const stamp = Date.now();

  if (format === 'csv') {
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    let csv = 'Time,Item,Category,Destination,Status\n';
    logs.forEach(l => {
      csv += [l.time, l.item, l.category, l.dest, l.status].map(esc).join(',') + '\n';
    });
    downloadBlob(csv, 'text/csv;charset=utf-8', `recycling-audit-${stamp}.csv`);
  } else {
    const payload = {
      exportedAt: new Date().toISOString(),
      telemetry: {
        totalScannedCount: dt.totalScannedCount,
        totalMassKg: dt.totalMassKg,
        co2AvoidedKg: dt.co2AvoidedKg,
        landfillDiversionRate: dt.landfillDiversionRate,
        energySavedKwh: dt.energySavedKwh,
        waterSavedLiters: dt.waterSavedLiters,
        contaminationAlerts: dt.contaminationAlerts
      },
      facilities: dt.facilityMetrics,
      logs
    };
    downloadBlob(JSON.stringify(payload, null, 2), 'application/json', `recycling-audit-${stamp}.json`);
  }
}

function downloadBlob(data, mime, filename) {
  const blob = new Blob([data], { type: mime });
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
}

async function toggleCamera() {
  const toggleBtn = document.getElementById('btn-toggle-camera');
  if (state.isCameraActive) {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(track => track.stop());
    }
    state.isCameraActive = false;
    if (state.isContinuousScanActive) {
      clearInterval(state.continuousScanInterval);
      state.isContinuousScanActive = false;
    }
    videoEl.classList.add('hidden');
    cameraPlaceholder.classList.remove('hidden');
    if (toggleBtn) toggleBtn.innerHTML = '📷 Start Webcam';
  } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
      });
      state.cameraStream = stream;
      state.isCameraActive = true;
      videoEl.srcObject = stream;
      videoEl.classList.remove('hidden');
      cameraPlaceholder.classList.add('hidden');
      if (toggleBtn) toggleBtn.innerHTML = '🛑 Stop Webcam';
      speakVoice('Webcam active. Real-time neural object detection ready.');
    } catch (err) {
      alert('Unable to access webcam. Please check browser permissions or use image upload / sample items.');
      console.error('Camera access error:', err);
    }
  }
}

function captureCameraSnapshot() {
  if (!state.isCameraActive || !videoEl) {
    processDetectedItem(state.currentItem);
    return;
  }
  processDetectedItem(videoEl, 'camera');
}

function handleFileUpload(e) {
  if (e.target.files && e.target.files[0]) {
    processUploadedFile(e.target.files[0]);
  }
}

function processUploadedFile(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      if (previewImage) {
        previewImage.src = event.target.result;
        previewImage.classList.remove('hidden');
      }
      if (cameraPlaceholder) cameraPlaceholder.classList.add('hidden');
      if (videoEl) videoEl.classList.add('hidden');

      // Process with frontend vision + backend persistence
      processDetectedItem(img, 'upload');

      // Optionally call backend Python bridge as well
      api.postScanImage(event.target.result, file.name).catch(e => console.warn('Backend image scan notice:', e));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
