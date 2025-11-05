
// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => res.send('Coal Blend API running'));

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGO;
if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI not set in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=>console.log('✅ MongoDB connected'))
  .catch(err=>{
    console.error('MongoDB connection error:', err && err.message ? err.message : err);
    process.exit(1);
  });

/* -------------------- Coal model -------------------- */
const CoalSchema = new mongoose.Schema({
  coal: String,
  SiO2: Number,
  Al2O3: Number,
  Fe2O3: Number,
  CaO: Number,
  MgO: Number,
  Na2O: Number,
  K2O: Number,
  TiO2: Number,
  SO3: Number,
  P2O5: Number,
  Mn3O4: Number,
  SulphurS: Number,
  gcv: Number,
  cost: Number,
  color: String
}, { collection: 'coals', strict: false });

const Coal = mongoose.models.Coal || mongoose.model('Coal', CoalSchema);

/* -------------------- Blend model -------------------- */
const BlendSchema = new mongoose.Schema({
  rows: { type: Array, default: [] },
  flows: { type: [Number], default: [] },
  generation: { type: Number, default: 0 },
  bunkers: { type: Array, default: [] },
  bunkerCapacity: { type: Number, default: 0 },
  bunkerCapacities: { type: [Number], default: [] },
  totalFlow: { type: Number, default: 0 },
  avgGCV: { type: Number, default: 0 },
  avgAFT: { type: Number, default: null },
  heatRate: { type: Number, default: null },
  costRate: { type: Number, default: 0 },
  aftPerMill: { type: [Number], default: [] },
  blendedGCVPerMill: { type: [Number], default: [] },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'blends', strict: false });

const Blend = mongoose.models.Blend || mongoose.model('Blend', BlendSchema);

/* -------------------- Unit collections (unit1, unit2, unit3) -------------------- */
function getUnitModel(unit) {
  const n = Number(unit);
  if (![1,2,3].includes(n)) throw new Error('unit must be 1, 2 or 3');
  const modelName = `Unit${n}`;
  const collName = `unit${n}`;
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  const UnitSchema = new mongoose.Schema({
    blendId: { type: mongoose.Schema.Types.ObjectId, ref: 'Blend' },
    snapshot: { type: mongoose.Schema.Types.Mixed },
    savedAt: { type: Date, default: Date.now }
  }, { collection: collName, strict: false });
  return mongoose.model(modelName, UnitSchema);
}

/* -------------------- Upload Excel -> Coal collection -------------------- */
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/api/upload-coal', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    const coalData = jsonData.map(item => ( {
      coal: item['Coal'] || item['coal'] || item['Name'] || '',
      SiO2: item['SiO2'] || item['SiO₂'] || 0,
      Al2O3: item['Al2O3'] || item['Al₂O₃'] || 0,
      Fe2O3: item['Fe2O3'] || item['Fe₂O₃'] || 0,
      CaO: item['CaO'] || 0,
      MgO: item['MgO'] || 0,
      Na2O: item['Na2O'] || 0,
      K2O: item['K2O'] || 0,
      TiO2: item['TiO2'] || 0,
      SO3: item['SO3'] || 0,
      P2O5: item['P2O5'] || 0,
      Mn3O4: item['Mn3O4'] || item['MN3O4'] || 0,
      SulphurS: item['Sulphur'] || item['SulphurS'] || 0,
      gcv: item['GCV'] || item['gcv'] || 0,
      cost: item['Cost'] || item['cost'] || 0,
      color: item['Color'] || item['color'] || item['colour'] || item['hex'] || ''
    }));

    await Coal.deleteMany({});
    if (coalData.length) await Coal.insertMany(coalData);
    return res.json({ message: 'Coal uploaded' });
  } catch (err) {
    console.error('upload error', err);
    return res.status(500).json({ error: 'Failed to parse/upload' });
  }
});

/* -------------------- Coal GET endpoints -------------------- */
app.get('/api/coals', async (req, res) => {
  try {
    const items = await Coal.find().lean();
    return res.json(items);
  } catch (err) {
    console.error('GET /api/coals error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});
app.get('/api/coalnames', async (req, res) => {
  try {
    const items = await Coal.find({}, { coal: 1 }).lean();
    return res.json(items);
  } catch (err) {
    console.error('GET /api/coalnames error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});
app.get('/api/coal/count', async (req, res) => {
  try { const c = await Coal.countDocuments(); return res.json({ count: c }); } 
  catch (err) { return res.status(500).json({ error: err.message || 'Server error' }); }
});

/* -------------------- AFT formula -------------------- */
function calcAFT(ox) {
  const total = Object.keys(ox || {}).reduce((s, k) => s + (Number(ox[k]) || 0), 0);
  if (total === 0) return 0;
  const SiO2 = Number(ox.SiO2) || 0;
  const Al2O3 = Number(ox.Al2O3) || 0;
  const Fe2O3 = Number(ox.Fe2O3) || 0;
  const CaO = Number(ox.CaO) || 0;
  const MgO = Number(ox.MgO) || 0;
  const Na2O = Number(ox.Na2O) || 0;
  const K2O = Number(ox.K2O) || 0;
  const SO3 = Number(ox.SO3) || 0;
  const TiO2 = Number(ox.TiO2) || 0;

  const sum = SiO2 + Al2O3;
  let aft = 0;
  if (sum < 55) {
    aft = 1245 + (1.1 * SiO2) + (0.95 * Al2O3) - (2.5 * Fe2O3) - (2.98 * CaO) - (4.5 * MgO)
      - (7.89 * (Na2O + K2O)) - (1.7 * SO3) - (0.63 * TiO2);
  } else if (sum < 75) {
    aft = 1323 + (1.45 * SiO2) + (0.683 * Al2O3) - (2.39 * Fe2O3) - (3.1 * CaO) - (4.5 * MgO)
      - (7.49 * (Na2O + K2O)) - (2.1 * SO3) - (0.63 * TiO2);
  } else {
    aft = 1395 + (1.2 * SiO2) + (0.9 * Al2O3) - (2.5 * Fe2O3) - (3.1 * CaO) - (4.5 * MgO)
      - (7.2 * (Na2O + K2O)) - (1.7 * SO3) - (0.63 * TiO2);
  }
  return Number(aft);
}

/* -------------------- computeBlendMetrics -------------------- */
async function computeBlendMetrics(rows, flows, generation, coalColorMap = {}) {
  const oxKeys = ["SiO2","Al2O3","Fe2O3","CaO","MgO","Na2O","K2O","SO3","TiO2"];

  const allCoals = await Coal.find().lean();
  const byId = {};
  const byNameLower = {};
  allCoals.forEach(c => {
    if (c._id) byId[String(c._id)] = c;
    if (c.coal) byNameLower[String(c.coal).toLowerCase()] = c;
  });

  function findCoalRef(ref) {
    if (!ref) return null;
    if (byId[String(ref)]) return byId[String(ref)];
    const lower = String(ref).toLowerCase();
    if (byNameLower[lower]) return byNameLower[lower];
    return null;
  }

  function coalRefForRowAndMill(row, mill) {
    if (!row) return null;
    if (row.coal && typeof row.coal === 'object' && row.coal !== null) {
      return row.coal[String(mill)] || '';
    }
    return row.coal || '';
  }

  function resolveColorForCoal(coalRef, coalDoc) {
    if (coalDoc && coalDoc.color) return String(coalDoc.color).trim();
    if (coalColorMap) {
      if (coalDoc && coalDoc._id) {
        const idStr = String(coalDoc._id);
        if (coalColorMap[`id:${idStr}`]) return coalColorMap[`id:${idStr}`];
        if (coalColorMap[idStr]) return coalColorMap[idStr];
      }
      if (coalRef) {
        if (coalColorMap[`name:${coalRef}`]) return coalColorMap[`name:${coalRef}`];
        if (coalColorMap[coalRef]) return coalColorMap[coalRef];
        if (coalColorMap[String(coalRef).toLowerCase()]) return coalColorMap[String(coalRef).toLowerCase()];
      }
    }
    return '';
  }

  const blendedGCVPerMill = [];
  const aftPerMill = [];

  for (let m = 0; m < 8; m++) {
    let blendedGCV = 0;
    const ox = {};
    oxKeys.forEach(k => ox[k] = 0);

    for (let i = 0; i < (rows ? rows.length : 0); i++) {
      const row = rows[i] || {};
      const perc = (Array.isArray(row.percentages) && row.percentages[m]) ? Number(row.percentages[m]) : 0;
      const weight = perc / 100;

      const coalRef = coalRefForRowAndMill(row, m);
      const coalDoc = findCoalRef(coalRef);

      const gcvVal = (row.gcv !== undefined && row.gcv !== null && row.gcv !== '') ? Number(row.gcv) : (coalDoc ? (Number(coalDoc.gcv) || 0) : 0);
      blendedGCV += gcvVal * weight;

      if (coalDoc) {
        oxKeys.forEach(k => {
          ox[k] += (Number(coalDoc[k]) || 0) * weight;
        });
      } else {
        oxKeys.forEach(k => {
          if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
            ox[k] += (Number(row[k]) || 0) * weight;
          }
        });
      }
    }

    blendedGCVPerMill.push(Number(blendedGCV));
    const oxTotal = Object.values(ox).reduce((s, v) => s + (Number(v) || 0), 0);
    const aftVal = (oxTotal === 0) ? null : Number(calcAFT(ox));
    aftPerMill.push(aftVal);
  }

  // totals & weighted averages using flows
  let totalFlow = 0;
  let weightedGCV = 0;
  let weightedAFT = 0;
  let contributedAFTFlow = 0;

  for (let m = 0; m < 8; m++) {
    const flow = (Array.isArray(flows) && flows[m]) ? Number(flows[m]) : 0;
    totalFlow += flow;
    weightedGCV += flow * (blendedGCVPerMill[m] || 0);

    const aftVal = aftPerMill[m];
    if (aftVal !== null && !isNaN(aftVal)) {
      weightedAFT += flow * aftVal;
      contributedAFTFlow += flow;
    }
  }

  const avgGCV = totalFlow > 0 ? (weightedGCV / totalFlow) : 0;
  const avgAFT = contributedAFTFlow > 0 ? (weightedAFT / contributedAFTFlow) : null;
  const heatRate = (generation && generation > 0 && totalFlow > 0) ? ((totalFlow * avgGCV) / generation) : null;

  function rowQtySum(row) {
    if (!row || !Array.isArray(row.percentages)) return 0;
    return row.percentages.reduce((s, v) => s + (Number(v) || 0), 0);
  }
  const qtyPerRow = (rows || []).map(rowQtySum);
  const costPerRow = (rows || []).map((r, idx) => {
    if (r && r.cost !== undefined && r.cost !== null && r.cost !== '') return Number(r.cost) || 0;
    const cdoc = findCoalRef((r || {}).coal);
    return cdoc ? (Number(cdoc.cost) || 0) : 0;
  });

  let totalCost = 0, totalQty = 0;
  for (let i = 0; i < qtyPerRow.length; i++) {
    totalCost += (qtyPerRow[i] || 0) * (costPerRow[i] || 0);
    totalQty += (qtyPerRow[i] || 0);
  }
  const costRate = totalQty > 0 ? (totalCost / totalQty) : 0;

  // Build per-bunker layers with color and basic layer info
  const bunkers = [];
  for (let m = 0; m < 8; m++) {
    const layers = [];
    for (let rIdx = 0; rIdx < (rows || []).length; rIdx++) {
      const row = rows[rIdx];
      const pct = (Array.isArray(row.percentages) && row.percentages[m]) ? Number(row.percentages[m]) : 0;
      if (!pct || pct <= 0) continue;
      const coalRef = coalRefForRowAndMill(row, m);
      const coalDoc = findCoalRef(coalRef);
      const layerColor = resolveColorForCoal(coalRef, coalDoc);
      layers.push({
        rowIndex: rIdx + 1,
        coal: coalDoc ? coalDoc.coal : (coalRef || ''),
        percent: Number(pct),
        gcv: coalDoc ? (Number(coalDoc.gcv) || Number(row.gcv || 0)) : Number(row.gcv || 0),
        cost: coalDoc ? (Number(coalDoc.cost) || Number(row.cost || 0)) : Number(row.cost || 0),
        color: layerColor || ''
      });
    }
    bunkers.push({ layers });
  }

  return {
    totalFlow: Number(totalFlow),
    avgGCV: Number(avgGCV),
    avgAFT: (avgAFT === null ? null : Number(avgAFT)),
    heatRate: (heatRate === null ? null : Number(heatRate)),
    costRate: Number(costRate),
    aftPerMill: aftPerMill.map(v => (v === null ? null : Number(v))),
    blendedGCVPerMill: blendedGCVPerMill.map(v => Number(v)),
    bunkers
  };
}



/* -------------------- Submit unit: saves Blend + snapshot (with timers) -------------------- */
app.post('/api/submit/:unit', async (req, res) => {
  try {
    const unit = Number(req.params.unit || 0);
    if (![1,2,3].includes(unit)) return res.status(400).json({ error: 'unit must be 1, 2 or 3' });

    const { rows, flows, generation, bunkerCapacity, bunkerCapacities, clientBunkers, coalColorMap, clientSavedAt } = req.body;
    if (!Array.isArray(rows) || !Array.isArray(flows)) return res.status(400).json({ error: 'Invalid payload: rows[] and flows[] required' });

    const rowsSan = (rows || []).map(r => {
      const copy = Object.assign({}, r);
      copy.percentages = Array.isArray(r.percentages) ? r.percentages.map(v => Number(v)||0) : [];
      copy.gcv = (copy.gcv !== undefined && copy.gcv !== null) ? Number(copy.gcv) : 0;
      copy.cost = (copy.cost !== undefined && copy.cost !== null) ? Number(copy.cost) : 0;
      return copy;
    });

    const metrics = await computeBlendMetrics(rowsSan, flows, generation, coalColorMap || {});
    const blendDoc = new Blend(Object.assign({}, {
      rows: rowsSan,
      flows,
      generation,
      bunkerCapacity: Number(bunkerCapacity) || 0,
      bunkerCapacities: Array.isArray(bunkerCapacities) ? bunkerCapacities.map(v => Number(v||0)) : [],
      bunkers: metrics.bunkers || []
    }, metrics));
    await blendDoc.save();

    // Build snapshot and compute initialSeconds per bunker and per layer
    const snapshot = {
      rows: rowsSan,
      flows,
      generation,
      bunkerCapacity: Number(bunkerCapacity) || 0,
      bunkerCapacities: Array.isArray(bunkerCapacities) ? bunkerCapacities.map(v => Number(v||0)) : [],
      clientBunkers: clientBunkers || [],
      metrics,
      coalColorMap: coalColorMap || {}
    };

    // compute timers: initialSeconds per layer & per bunker
    const bc = Number(snapshot.bunkerCapacity || 0);
    snapshot.bunkerTimers = [];
    for (let m = 0; m < 8; m++) {
      const flow = (Array.isArray(snapshot.flows) && snapshot.flows[m]) ? Number(snapshot.flows[m]) : 0;
      const bunker = { initialSeconds: null, layers: [] };
      // total percent of bunker
      const totalPct = (snapshot.clientBunkers && snapshot.clientBunkers[m] && Array.isArray(snapshot.clientBunkers[m].layers))
        ? snapshot.clientBunkers[m].layers.reduce((s, L) => s + (Number(L.percent) || 0), 0)
        : 0;
      if (flow > 0 && bc > 0) {
        bunker.initialSeconds = totalPct > 0 ? ( (totalPct / 100) * bc / flow * 3600 ) : 0;
      } else {
        bunker.initialSeconds = null;
      }

      // per-layer
      const layerList = (snapshot.clientBunkers && snapshot.clientBunkers[m] && Array.isArray(snapshot.clientBunkers[m].layers))
        ? snapshot.clientBunkers[m].layers : [];

      for (let li = 0; li < layerList.length; li++) {
        const layer = layerList[li];
        const pct = Number(layer.percent || 0);
        let initialSeconds = null;
        if (flow > 0 && bc > 0 && pct > 0) {
          // seconds = (pct/100 * bc) / flow * 3600
          initialSeconds = (pct / 100) * bc / flow * 3600;
        }
        // attach initialSeconds to layer metadata in snapshot (so client can use it later)
        bunker.layers.push(Object.assign({}, layer, { initialSeconds }));
      }
      snapshot.bunkerTimers.push(bunker);
    }

    // saveAt: prefer clientSavedAt if provided (client time), else server time
    let savedAt;
    if (clientSavedAt) {
      const parsed = new Date(clientSavedAt);
      if (!isNaN(parsed.getTime())) savedAt = parsed;
      else savedAt = new Date();
    } else {
      savedAt = new Date();
    }

    const UnitModel = getUnitModel(unit);
    const docToSave = {
      blendId: blendDoc._id,
      snapshot,
      savedAt: savedAt
    };
    // replaceOne to keep single doc per collection
    await UnitModel.replaceOne({}, docToSave, { upsert: true });

    return res.status(201).json({ message: 'Unit submitted', unit, blendId: String(blendDoc._id) });
  } catch (err) {
    console.error('POST /api/submit/:unit error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

/* -------------------- GET unit: returns snapshot with remaining time adjusted by elapsed ------------ */
app.get('/api/unit/:unit', async (req, res) => {
  try {
    const unit = Number(req.params.unit || 0);
    if (![1,2,3].includes(unit)) return res.status(400).json({ error: 'unit must be 1, 2 or 3' });
    const UnitModel = getUnitModel(unit);
    const unitDoc = await UnitModel.findOne({}).lean();
    if (!unitDoc) return res.status(404).json({ error: 'No submission stored for this unit' });

    // Do not mutate DB: create a deep copy of the doc to adjust remaining values based on elapsed
    const copy = JSON.parse(JSON.stringify(unitDoc));
    const savedAt = copy.savedAt ? new Date(copy.savedAt) : new Date();
    const now = new Date();
    const elapsedSec = Math.max(0, (now.getTime() - savedAt.getTime()) / 1000);

    // adjust per-bunker and per-layer remaining values using initialSeconds saved in snapshot.bunkerTimers
    if (copy.snapshot && Array.isArray(copy.snapshot.bunkerTimers)) {
      const bc = Number(copy.snapshot.bunkerCapacity || 0);
      const flows = Array.isArray(copy.snapshot.flows) ? copy.snapshot.flows : (copy.snapshot.flows || Array(8).fill(0));
      // ensure clientBunkers array exists for consistent return
      copy.snapshot.clientBunkers = Array.isArray(copy.snapshot.clientBunkers) ? copy.snapshot.clientBunkers : Array(8).fill({ layers: [] }).map(()=>({ layers: [] }));

      for (let m = 0; m < Math.max(8, (copy.snapshot.bunkerTimers || []).length); m++) {
        const btimer = (copy.snapshot.bunkerTimers && copy.snapshot.bunkerTimers[m]) ? copy.snapshot.bunkerTimers[m] : null;
        const flow = Number((flows && flows[m]) ? flows[m] : 0);
        const layerList = (copy.snapshot.clientBunkers && copy.snapshot.clientBunkers[m] && Array.isArray(copy.snapshot.clientBunkers[m].layers)) ? copy.snapshot.clientBunkers[m].layers : [];

        // if btimer.initialSeconds exists, compute remaining bunker seconds
        let bunkerRemainingSeconds = null;
        if (btimer && btimer.initialSeconds != null) {
          bunkerRemainingSeconds = Math.max(0, Number(btimer.initialSeconds) - elapsedSec);
        } else {
          // fallback compute from percent sum if possible
          const totalPct = layerList.reduce((s, L) => s + (Number(L.percent)||0), 0);
          if (flow > 0 && bc > 0 && totalPct > 0) {
            const initial = (totalPct / 100) * bc / flow * 3600;
            bunkerRemainingSeconds = Math.max(0, initial - elapsedSec);
          } else {
            bunkerRemainingSeconds = null;
          }
        }

        // update each layer percent & add remainingSeconds
        for (let li = 0; li < layerList.length; li++) {
          const layer = layerList[li];
          const initSec = (btimer && btimer.layers && btimer.layers[li] && btimer.layers[li].initialSeconds != null) ? Number(btimer.layers[li].initialSeconds) : null;

          let remainingSeconds = null;
          if (initSec != null) {
            remainingSeconds = Math.max(0, initSec - elapsedSec);
          } else if (flow > 0 && bc > 0) {
            const pct = Number(layer.percent || 0);
            if (pct > 0) {
              const computedInit = (pct / 100) * bc / flow * 3600;
              remainingSeconds = Math.max(0, computedInit - elapsedSec);
            } else {
              remainingSeconds = 0;
            }
          } else {
            remainingSeconds = null;
          }

          // compute remaining percent from remainingSeconds proportionally to initialSeconds
          let remainingPercent = Number(layer.percent || 0);
          if (initSec != null && initSec > 0 && remainingSeconds != null) {
            remainingPercent = (remainingSeconds / initSec) * Number(layer.percent || 0);
            if (!isFinite(remainingPercent)) remainingPercent = 0;
          } else if (initSec == null && remainingSeconds != null && flow > 0 && bc > 0) {
            // fallback: compute proportion using computedInit
            const pct = Number(layer.percent || 0);
            const computedInit = (pct / 100) * bc / flow * 3600;
            if (computedInit > 0) {
              remainingPercent = (remainingSeconds / computedInit) * pct;
              if (!isFinite(remainingPercent)) remainingPercent = 0;
            }
          }

          // clamp and round
          remainingPercent = Math.max(0, Number((remainingPercent || 0).toFixed(6)));
          layer.remainingSeconds = (remainingSeconds == null ? null : Number(remainingSeconds));
          layer.percent = remainingPercent;
        } // per-layer loop

        // attach bunkerRemainingSeconds to copy.snapshot.bunkerTimers for client convenience
        if (!copy.snapshot.bunkerTimers) copy.snapshot.bunkerTimers = [];
        if (!copy.snapshot.bunkerTimers[m]) copy.snapshot.bunkerTimers[m] = {};
        copy.snapshot.bunkerTimers[m].remainingSeconds = (bunkerRemainingSeconds == null ? null : Number(bunkerRemainingSeconds));
      } // bunker loop
    }

    // Return the adjusted doc (not persisted) along with populated blend if present
    let blend = null;
    if (unitDoc.blendId) {
      try { blend = await Blend.findById(unitDoc.blendId).lean(); } catch(e){ blend = null; }
    }
    return res.json({ unit, doc: copy, blend });
  } catch (err) {
    console.error('GET /api/unit/:unit error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

/* -------------------- Units summary debug -------------------- */
app.get('/api/units/summary', async (req, res) => {
  try {
    const results = {};
    for (let u = 1; u <= 3; u++) {
      const m = getUnitModel(u);
      const doc = await m.findOne({}).lean();
      results[`unit${u}`] = doc || null;
    }
    return res.json(results);
  } catch (err) {
    console.error('GET /api/units/summary error', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

/* -------------------- Start server -------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
