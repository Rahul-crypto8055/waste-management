// Pre-loaded realistic sample dataset covering all 4 target classes:
// 1. Recyclable
// 2. Reusable
// 3. Biodegradable
// 4. Hazardous

export const SAMPLE_ITEMS = [
  {
    id: 'pet-bottle',
    name: 'PET Water Bottle (500ml)',
    category: 'recyclable',
    categoryLabel: 'Recyclable',
    confidence: 0.96,
    material: 'Polyethylene Terephthalate (#1 PET)',
    massGrams: 28,
    co2SavedKg: 0.082,
    decompositionYears: 450,
    facility: 'Materials Recovery Facility (MRF - Optical Sorting)',
    badgeColor: 'emerald',
    icon: 'Recycle',
    description: 'Clean clear plastic beverage container. High market demand for polyester fiber & rPET bottles.',
    preparation: [
      'Empty all liquid contents completely',
      'Quick rinse with water if sticky',
      'Crush bottle lengthwise to save bin space',
      'Keep cap on (modern facilities capture caps via float-sink separation)'
    ],
    upcycleIdeas: [
      'Self-watering planter for microgreens or kitchen herbs',
      'Bird feeder with wooden spoon perches',
      'Drip irrigation funnel for houseplants'
    ],
    imageType: 'bottle',
    color: '#06b6d4'
  },
  {
    id: 'aluminum-can',
    name: 'Aluminum Soda Can (330ml)',
    category: 'recyclable',
    categoryLabel: 'Recyclable',
    confidence: 0.98,
    material: 'Infinite-Recyclability Aluminum (Al)',
    massGrams: 15,
    co2SavedKg: 0.145,
    decompositionYears: 200,
    facility: 'Secondary Smelter & Ingot Casting Unit',
    badgeColor: 'emerald',
    icon: 'Recycle',
    description: 'Infinitely recyclable aluminum. Recycling saves 95% of the energy needed to refine virgin bauxite ore.',
    preparation: [
      'Rinse out sugary residues to deter pests',
      'Leave tab attached to avoid shredder loss',
      'Do not crush completely if using automated reverse-vending machines'
    ],
    upcycleIdeas: [
      'Pencil & paintbrush desk organizer',
      'Outdoor tealight lantern with pinhole patterns',
      'Camp stove windscreen'
    ],
    imageType: 'can',
    color: '#38bdf8'
  },
  {
    id: 'cardboard-box',
    name: 'Corrugated Shipping Box',
    category: 'recyclable',
    categoryLabel: 'Recyclable',
    confidence: 0.94,
    material: 'Unbleached Kraft Pulp Fiber',
    massGrams: 180,
    co2SavedKg: 0.32,
    decompositionYears: 0.3,
    facility: 'Paper & Pulp Hydropulper Recycling Mill',
    badgeColor: 'emerald',
    icon: 'Recycle',
    description: 'High-grade paper packaging. Can be re-pulped up to 5-7 times into new shipping materials.',
    preparation: [
      'Remove excess plastic packing tape & shipping labels if plastic-laminated',
      'Flatten completely to optimize compaction in collection vehicles',
      'Ensure it is dry and free of greasy food contamination'
    ],
    upcycleIdeas: [
      'Drawer dividers and closet organizing bins',
      'Sheet mulching layer for weed suppression in garden beds',
      'Cat scratching playhouse'
    ],
    imageType: 'box',
    color: '#fbbf24'
  },
  {
    id: 'cotton-tote',
    name: 'Canvas Tote Bag',
    category: 'reusable',
    categoryLabel: 'Reusable',
    confidence: 0.95,
    material: '100% Woven Organic Cotton',
    massGrams: 120,
    co2SavedKg: 1.85,
    decompositionYears: 0.5,
    facility: 'Second-Life Textile & Reuse Exchange Depot',
    badgeColor: 'cyan',
    icon: 'RefreshCw',
    description: 'High-durability fabric container designed for 300+ duty cycles. Replaces 500+ single-use plastic bags over lifetime.',
    preparation: [
      'Machine wash cold to refresh fabric',
      'Fold and keep in vehicle, backpack, or doorway for grocery trips',
      'Mend minor stitch tears with needle and thread'
    ],
    upcycleIdeas: [
      'Cushion cover or decorative wall banner',
      'Produce bag for root vegetables and onions',
      'Fabric storage basket for cords and chargers'
    ],
    imageType: 'tote',
    color: '#06b6d4'
  },
  {
    id: 'stainless-tumbler',
    name: 'Insulated Stainless Steel Flask',
    category: 'reusable',
    categoryLabel: 'Reusable',
    confidence: 0.97,
    material: 'Food-Grade 18/8 (304) Stainless Steel',
    massGrams: 340,
    co2SavedKg: 4.20,
    decompositionYears: 1000,
    facility: 'Direct Reuse & Community Exchange',
    badgeColor: 'cyan',
    icon: 'RefreshCw',
    description: 'Heavy-duty vacuum insulated bottle. Eliminates ~167 disposable single-use water bottles annually per person.',
    preparation: [
      'Deep clean with warm water, vinegar, or baking soda',
      'Check silicone gasket seal for tightness',
      'Keep in daily rotation'
    ],
    upcycleIdeas: [
      'Water reservoir for slow-drip indoor plant hydration',
      'Emergency coin bank or airtight survival storage',
      'Donate to community gear drive if no longer needed'
    ],
    imageType: 'tumbler',
    color: '#94a3b8'
  },
  {
    id: 'banana-peel',
    name: 'Organic Banana Peel & Scraps',
    category: 'biodegradable',
    categoryLabel: 'Biodegradable',
    confidence: 0.98,
    material: 'Potassium-Rich Lignocellulosic Biomass',
    massGrams: 65,
    co2SavedKg: 0.058,
    decompositionYears: 0.05,
    facility: 'Anaerobic Digester & Thermophilic Composting Reactor',
    badgeColor: 'lime',
    icon: 'Leaf',
    description: 'High-moisture organic waste. Rapidly transforms into nutrient-dense humus and methane biogas for green electricity.',
    preparation: [
      'Chop into smaller pieces to accelerate bacterial digestion',
      'Remove synthetic produce sticker labels',
      'Deposit in green organics bin or backyard compost pile'
    ],
    upcycleIdeas: [
      'Soak in water for 48h to make potassium-rich liquid houseplant fertilizer',
      'Rub inner skin on plant leaves to clean dust and give a natural shine',
      'Mix into vermicomposting bin for earthworms'
    ],
    imageType: 'banana',
    color: '#eab308'
  },
  {
    id: 'apple-core',
    name: 'Fruit Core & Food Residue',
    category: 'biodegradable',
    categoryLabel: 'Biodegradable',
    confidence: 0.95,
    material: 'Biodegradable Dietary Fiber & Pectin',
    massGrams: 45,
    co2SavedKg: 0.042,
    decompositionYears: 0.04,
    facility: 'Municipal Composting Facility',
    badgeColor: 'lime',
    icon: 'Leaf',
    description: '100% natural organic scrap. Diverting from landfills eliminates anaerobic generation of harmful methane gas.',
    preparation: [
      'Keep in covered countertop compost crock with carbon filter',
      'Combine with dry brown materials (dry leaves, shredded unprinted cardboard) for 30:1 C:N balance',
      'Do not bag in non-certified standard plastic bags'
    ],
    upcycleIdeas: [
      'Simmer with cinnamon and citrus peels for all-natural stove aromatics',
      'Ferment scraps in water with a bit of sugar to make raw apple cider vinegar',
      'Direct garden trench composting'
    ],
    imageType: 'apple',
    color: '#ef4444'
  },
  {
    id: 'lithium-battery',
    name: 'Rechargeable Li-Ion / Alkaline Battery',
    category: 'hazardous',
    categoryLabel: 'Hazardous Waste',
    confidence: 0.99,
    material: 'Lithium, Cobalt, Nickel & Corrosive Electrolyte',
    massGrams: 48,
    co2SavedKg: 0.45,
    decompositionYears: 1000,
    facility: 'Certified E-Waste Hydrometallurgical Recovery Vault',
    badgeColor: 'rose',
    icon: 'AlertTriangle',
    description: 'CRITICAL HAZARD: Must NEVER enter standard trash or recycling bins! Can cause thermal runaway fires in collection trucks and leach heavy metals into groundwater.',
    preparation: [
      'Cover electrical contact terminals with clear electrical tape to prevent short circuits',
      'Store in a non-conductive, fire-safe container at room temperature',
      'Drop off at certified e-waste collection center, retail drop box (e.g. Best Buy, Home Depot, or municipal hazardous depot)'
    ],
    upcycleIdeas: [
      'Do NOT attempt DIY disassembly (fire and toxic chemical danger)',
      'Check if device firmware has battery health calibration before discarding',
      'Take advantage of manufacturer trade-in or takeback rebates'
    ],
    imageType: 'battery',
    color: '#f43f5e'
  },
  {
    id: 'aerosol-can',
    name: 'Pressurized Aerosol Spray Can',
    category: 'hazardous',
    categoryLabel: 'Hazardous Waste',
    confidence: 0.93,
    material: 'Pressurized Hydrocarbon Propellant & Steel Casing',
    massGrams: 110,
    co2SavedKg: 0.18,
    decompositionYears: 150,
    facility: 'De-pressurization & Hazardous Waste Treatment Facility',
    badgeColor: 'rose',
    icon: 'AlertTriangle',
    description: 'Pressurized vessel. If not completely empty, presents explosion risk during mechanical baling at recycling centers.',
    preparation: [
      'Verify if completely empty by holding nozzle until hiss stops',
      'If still containing chemical residue or pressure, treat strictly as household hazardous waste (HHW)',
      'Never puncture, burn, or crush manually'
    ],
    upcycleIdeas: [
      'Not recommended for DIY crafts due to lingering propellant fumes',
      'Replace future purchases with refillable pump sprayers or solid bar alternatives'
    ],
    imageType: 'aerosol',
    color: '#e11d48'
  }
];

export const CATEGORY_METRICS = {
  recyclable: {
    title: 'Recyclable Materials',
    color: '#10b981',
    accent: 'emerald',
    icon: 'Recycle',
    badge: 'MRF Hub',
    description: 'Processed into secondary raw materials, reducing virgin extraction.',
    typicalItems: 'Plastics (PET, HDPE), Aluminum, Tin, Glass, Paper & Cardboard',
    handling: 'Empty, rinse, crush, and place in blue bin.',
    destFlow: 'Materials Recovery Facility (MRF)'
  },
  reusable: {
    title: 'Reusable Products',
    color: '#06b6d4',
    accent: 'cyan',
    icon: 'RefreshCw',
    badge: 'Circular Depot',
    description: 'Diverted from waste streams to achieve maximum lifespan and utility.',
    typicalItems: 'Bags, Bottles, Glass Jars, Utensils, Electronics, Clothing',
    handling: 'Clean, repair, repurpose, donate, or exchange in circular loops.',
    destFlow: 'Second-Life Exchange Depot'
  },
  biodegradable: {
    title: 'Biodegradable Organics',
    color: '#84cc16',
    accent: 'lime',
    icon: 'Leaf',
    badge: 'Compost Reactor',
    description: 'Natural biological materials that safely decompose into nutrient-rich soil.',
    typicalItems: 'Food Scraps, Peels, Coffee Grounds, Compostable Paper, Garden Waste',
    handling: 'Collect in ventilated container, compost, or place in green organic bin.',
    destFlow: 'Anaerobic Digester & Composting'
  },
  hazardous: {
    title: 'Hazardous Materials',
    color: '#f43f5e',
    accent: 'rose',
    icon: 'AlertTriangle',
    badge: 'Hazard Vault',
    description: 'Toxic, flammable, or reactive items requiring specialized environmental remediation.',
    typicalItems: 'Batteries, E-Waste, Chemicals, Fluorescent Bulbs, Paints, Solvents',
    handling: 'Tape terminals, keep separate, deliver to designated HHW facility.',
    destFlow: 'Certified Hazardous Remediation'
  }
};
