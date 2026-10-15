/**
 * Generative AI Circular Economy Advisory Service
 *
 * Primary path: Google Gemini (real LLM) for genuinely generative,
 * item-specific handling guidance, upcycle recipes, and free-form chat.
 *
 * Fallback path: a deterministic rule/knowledge-base engine that runs when
 * no GEMINI_API_KEY is set or the LLM is unreachable (e.g. offline demo).
 * This keeps the advisor working 100% of the time.
 *
 * The API key is read ONLY from the environment — never hardcoded, never
 * sent to the browser (all Gemini calls happen server-side).
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_TIMEOUT_MS = 8000;

const CHAT_SYSTEM = `You are the GenAI Circular Advisor inside a Smart Recycling Assistant app.
You are an expert on recycling, reuse, composting and hazardous-waste safety.
Answer the user's question with practical, accurate, locally-actionable guidance.
Be concise (under ~140 words). Use short bullet points and **bold** key terms.
For batteries, e-waste, aerosols or chemicals, lead with the safety warning.
Do not invent local pickup schedules or municipal rules you cannot know.`;

const ADVISE_SYSTEM = `You are a circular-economy advisor. Given one waste item, respond with
MINIFIED JSON ONLY (no prose, no markdown, no code fences) in exactly this shape:
{"handlingChecklist":["step","step","step"],"upcyclingProjects":["idea","idea","idea"]}
Each handling step is a short imperative prep instruction. Each upcycle idea is a
specific, creative reuse project tailored to this exact item. Hazardous items must
warn against DIY disassembly.`;

/**
 * Calls the Gemini REST API. Returns the generated text, or null on any
 * failure (no key, timeout, HTTP error) so callers can fall back cleanly.
 */
async function callGemini(systemInstruction, userPrompt) {
  if (!GEMINI_API_KEY) return null;
  if (typeof fetch !== 'function') return null; // very old Node without global fetch

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
      })
    });

    if (!res.ok) {
      console.warn('Gemini HTTP error', res.status);
      return null;
    }

    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('')
      .trim();

    return text || null;
  } catch (err) {
    console.warn('Gemini call failed, using fallback:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Strips code fences and parses a JSON object out of an LLM response. */
function tryParseJson(text) {
  if (!text) return null;
  try {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(cleaned.substring(start, end + 1));
  } catch (e) {
    return null;
  }
}

const CIRCULAR_KNOWLEDGE_BASE = {
  recyclable: {
    prepRules: [
      'Empty all residual liquid or food residue completely.',
      'Perform a 3-second cold water swirl rinse to avoid bacterial mold.',
      'Compress or flatten containers to maximize compaction volume in collection trucks.',
      'Keep screw caps on bottles (modern MRF facilities use float-sink floatation tanks).'
    ],
    diyUpcycles: [
      'Self-watering sub-irrigation planter for culinary herbs (basil, mint, cilantro).',
      'Bird feeder with wooden spoon perches and weather-proof seed funnel.',
      'Modular desk drawer organizer for electronics cables and stationery.'
    ]
  },
  reusable: {
    prepRules: [
      'Sanitize thoroughly using hot water, dish soap, or dilute vinegar solution.',
      'Inspect physical integrity (zippers, seams, gaskets, vacuum seals).',
      'Keep in high-frequency rotation in backpacks, vehicles, or entryway doorways.'
    ],
    diyUpcycles: [
      'Repurpose fabric bags into decorative wall storage or produce bags for onions/potatoes.',
      'Transform insulated tumblers into desk pencil jars or slow-drip indoor plant hydration vessels.',
      'Donate lightly used items to community gear exchanges or shelters.'
    ]
  },
  biodegradable: {
    prepRules: [
      'Chop thick rinds and cores into 1-2 cm pieces to accelerate thermophilic microbial breakdown.',
      'Carefully remove plastic fruit PLU adhesive stickers.',
      'Balance high-nitrogen greens (food scraps) with high-carbon browns (dry leaves, shredded unprinted cardboard) at a 1:30 ratio.'
    ],
    diyUpcycles: [
      '48-hour banana peel water brew: rich potassium liquid fertilizer for flowering houseplants.',
      'Simmer citrus and fruit scraps with cinnamon for natural non-toxic stove potpourri aromatics.',
      'Feed food scraps into backyard vermicomposting worm bins for nutrient-dense worm castings.'
    ]
  },
  hazardous: {
    prepRules: [
      'CRITICAL: Tape battery terminal contacts with non-conductive electrical tape immediately.',
      'Store in an airtight, non-conductive, puncture-resistant container away from heat or direct sunlight.',
      'NEVER dispose in municipal curbside carts; take to certified household hazardous waste (HHW) drop-offs.'
    ],
    diyUpcycles: [
      'DIY disassembly is strictly NOT recommended due to thermal runaway, fire, and chemical poisoning risks.',
      'Participate in manufacturer take-back or trade-in programs for gift cards and store credit.',
      'Check device firmware for battery health calibration before considering disposal.'
    ]
  }
};

/** Deterministic structured recommendation (always available). */
function buildDeterministicRecommendations(item) {
  const cat = (item.category || 'recyclable').toLowerCase();
  const knowledge = CIRCULAR_KNOWLEDGE_BASE[cat] || CIRCULAR_KNOWLEDGE_BASE.recyclable;

  const massKg = (item.massGrams || 50) / 1000;
  const co2Avoided = item.co2SavedKg || +(massKg * 1.8).toFixed(3);

  return {
    itemName: item.name || 'Identified Material',
    category: cat,
    targetFacility: item.facility || 'Assigned Sorting Hub',
    handlingChecklist: knowledge.prepRules,
    upcyclingProjects: knowledge.diyUpcycles,
    environmentalImpact: {
      co2AvoidedKg: co2Avoided,
      landfillVolumeSavedCm3: Math.round(massKg * 1400),
      equivalentTreesAbsorbingDay: +(co2Avoided * 16.5).toFixed(1),
      circularEfficiencyRating: cat === 'hazardous' ? 'Specialized Quarantine' : 'High Circular Retention'
    },
    source: 'knowledge-base'
  };
}

/**
 * Generate recommendations for a detected item.
 * Uses Gemini to produce item-specific handling + upcycle ideas when available,
 * overlaying them on the deterministic structured impact data.
 */
async function generateRecommendations(item) {
  const base = buildDeterministicRecommendations(item);

  const prompt = `Item: "${item.name || 'unknown'}" | Category: ${base.category} | ` +
    `Material: ${item.material || 'n/a'} | Facility: ${base.targetFacility}. ` +
    `Give handling steps and upcycle ideas specific to THIS item.`;

  const llm = await callGemini(ADVISE_SYSTEM, prompt);
  const parsed = tryParseJson(llm);

  if (parsed && Array.isArray(parsed.handlingChecklist) && parsed.handlingChecklist.length) {
    base.handlingChecklist = parsed.handlingChecklist.slice(0, 5);
    if (Array.isArray(parsed.upcyclingProjects) && parsed.upcyclingProjects.length) {
      base.upcyclingProjects = parsed.upcyclingProjects.slice(0, 5);
    }
    base.source = 'gemini';
  }

  return base;
}

/** Deterministic keyword chat engine (fallback). */
function ruleBasedChat(query) {
  const q = (query || '').toLowerCase().trim();

  if (q.includes('battery') || q.includes('batteries') || q.includes('lithium') || q.includes('cell')) {
    return {
      topic: 'Hazardous Batteries',
      severity: 'HIGH_PRIORITY_HAZARD',
      source: 'knowledge-base',
      response: `⚠️ **Hazardous Waste Protocol for Batteries:**\n\n1. **Fire Prevention:** Place clear electrical tape across both terminal poles to prevent short-circuit sparks.\n2. **Curbside Ban:** Never place lithium-ion or alkaline batteries in standard recycling bins or trash compactors; they cause truck fires!\n3. **Drop-Off Locations:** Deliver to retail collection boxes (e.g. Best Buy, Home Depot, Staples) or your municipal Household Hazardous Waste (HHW) depot.\n4. **Hydrometallurgy:** Certified recyclers extract 95%+ of cobalt, nickel, and lithium for new batteries.`
    };
  }

  if (q.includes('pizza') || q.includes('grease') || q.includes('box')) {
    return {
      topic: 'Greasy Food Packaging',
      severity: 'SORTING_CLARIFICATION',
      source: 'knowledge-base',
      response: `🍕 **The Greasy Pizza Box Rule:**\n\n- **The Issue:** Vegetable oils and animal fats saturate the cellulose cardboard fibers and cannot be washed out with water during paper re-pulping.\n- **The Action:** Tear the box in half!\n  - **Top Clean Lid:** Goes into the **Recyclable** bin.\n  - **Greasy Bottom Base:** Goes into the **Biodegradable / Composting** bin or backyard compost pile.`
    };
  }

  if (q.includes('plastic') || q.includes('pet') || q.includes('bottle') || q.includes('number')) {
    return {
      topic: 'Plastics & Resins',
      severity: 'STANDARD_RECYCLING',
      source: 'knowledge-base',
      response: `♻️ **Resin Identification Guide (Plastics #1–#7):**\n\n- **#1 (PET):** Water bottles, soda bottles. Highly recyclable into new rPET fiber and textiles.\n- **#2 (HDPE):** Milk jugs, detergent bottles. Top industrial demand for plastic lumber and pipes.\n- **#5 (PP):** Yogurt tubs, medication bottles. Increasingly accepted; ensure thoroughly rinsed.\n- **#3 (PVC) & #6 (PS/Styrofoam):** Rarely recycled curbside; avoid single-use consumption.`
    };
  }

  if (q.includes('compost') || q.includes('banana') || q.includes('food') || q.includes('organic')) {
    return {
      topic: 'Organic Composting',
      severity: 'CIRCULAR_COMPOST',
      source: 'knowledge-base',
      response: `🌱 **Circular Organics & Composting:**\n\n- When organic food scraps decompose anaerobically in landfills without oxygen, they produce **methane ($CH_4$)**, a greenhouse gas 28x more potent than $CO_2$.\n- Diverting scraps to composting creates oxygen-rich aerobic humus, sequestering carbon back into topsoil and regenerating local soil biodiversity.`
    };
  }

  if (q.includes('upcycle') || q.includes('diy') || q.includes('craft') || q.includes('idea')) {
    return {
      topic: 'DIY Upcycling Ideas',
      severity: 'CREATIVE_REUSE',
      source: 'knowledge-base',
      response: `🔄 **Creative Circular Upcycle Inspirations:**\n\n1. **Glass Jars:** Create tiered spice storage, air-plant terrariums, or sourdough starter containers.\n2. **Cotton Clothing:** Shred into lint-free cleaning cloths or hand-weave into braided rugs.\n3. **Cardboard Boxes:** Use as lasagna-gardening weed barrier mulch under topsoil.\n4. **Aluminum Cans:** Punch pinhole patterns with a nail to create outdoor solar tealight lanterns.`
    };
  }

  return {
    topic: 'General Circular Advisory',
    severity: 'STANDARD_ADVISORY',
    source: 'knowledge-base',
    response: `🤖 **Circular Economy AI Guidance:**\n\nFor *"**${query}**"*, ensure the item is properly identified before binning:\n- Clean, dry, and unsoiled recyclables preserve secondary market material value.\n- Reusable items should be preserved in duty cycles as long as possible.\n- Natural biological scraps belong in aerated composting.\n- Any item with circuits, batteries, or reactive chemicals must be quarantined as Hazardous Waste.`
  };
}

/**
 * Process a free-form chat query.
 * Uses Gemini for a genuinely generative answer when available,
 * otherwise falls back to the deterministic keyword engine.
 */
async function processChatQuery(query) {
  const llm = await callGemini(CHAT_SYSTEM, query || '');
  if (llm) {
    return {
      topic: 'GenAI Circular Advisor',
      severity: 'LLM_RESPONSE',
      source: 'gemini',
      response: llm
    };
  }
  return ruleBasedChat(query);
}

/** True when a Gemini key is configured (for health/status reporting). */
function isLlmEnabled() {
  return Boolean(GEMINI_API_KEY);
}

module.exports = {
  generateRecommendations,
  processChatQuery,
  isLlmEnabled
};
