// // src/App.jsx
// import React, { useEffect, useMemo, useState, useRef } from 'react';
// import Sidebar from './components/Sidebar';
// import BunkerDiagram from './components/BunkerDiagram';
// import api from './api/apiClient';

// function secondsToHHMMSS(secondsRaw) {
//   if (!isFinite(secondsRaw) || secondsRaw === null) return '--';
//   const s = Math.max(0, Math.round(secondsRaw));
//   const h = Math.floor(s / 3600);
//   const m = Math.floor((s % 3600) / 60);
//   const sec = s % 60;
//   return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
// }

// export default function App() {
//   const NUM = 8;

//   const [unit, setUnit] = useState(1);
//   const [bunkerCapacity, setBunkerCapacity] = useState(1000); // default
//   const [generation, setGeneration] = useState(0);
//   const [flows, setFlows] = useState(Array(NUM).fill(0)); // per-mill flow (TPH)
//   // clientBunkers: array of { layers: [ { coal, coalId, percent, gcv, cost, color, ... } ] }
//   const [clientBunkers, setClientBunkers] = useState(Array.from({ length: NUM }).map(()=>({ layers: [] })));

//   // load coals for early fetch (optional)
//   useEffect(() => { api.getCoals().catch(()=>[]); }, []);

//   // helpers to update flows array
//   function updateFlow(i, v) {
//     const val = Number(v) || 0;
//     setFlows(prev => {
//       const next = Array.isArray(prev) ? [...prev] : Array(NUM).fill(0);
//       next[i] = val;
//       return next;
//     });
//   }

//   // Add a layer to a bunker (pushed to top)
//   function addBunkerLayer(bunkerIndex, layer) {
//     setClientBunkers(prev => {
//       const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//       next[bunkerIndex].layers.push(layer);
//       return next;
//     });
//   }

//   // Remove the top (last) layer from a bunker
//   function removeTopLayer(bunkerIndex) {
//     setClientBunkers(prev => {
//       const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//       if (next[bunkerIndex].layers.length > 0) {
//         next[bunkerIndex].layers.pop();
//       }
//       return next;
//     });
//   }

//   // compute totals per bunker (sum of percent)
//   const totals = useMemo(() => {
//     return clientBunkers.map(b => {
//       const s = (b.layers || []).reduce((acc, L) => acc + (Number(L.percent) || 0), 0);
//       return Number(s);
//     });
//   }, [clientBunkers]);

//   // compute timer (seconds) per bunker using formula you provided
//   const timersSeconds = useMemo(() => {
//     return totals.map((totalPct, idx) => {
//       const flow = Number(flows[idx] || 0);
//       const bc = Number(bunkerCapacity || 0);
//       if (totalPct <= 0 || bc <= 0 || flow <= 0) return null;
//       // hours = (totalPct/100 * bunkerCapacity) / flow
//       const hours = (totalPct / 100) * bc / flow;
//       return Math.max(0, hours * 3600);
//     });
//   }, [totals, flows, bunkerCapacity]);

//   // Drain logic: percent/sec = (flow_tph / 3600) / bunkerCapacity * 100
//   // We'll run a 1-second tick that reduces top layer percent accordingly.
//   const drainIntervalRef = useRef(null);
//   useEffect(() => {
//     // clear any existing interval
//     if (drainIntervalRef.current) {
//       clearInterval(drainIntervalRef.current);
//       drainIntervalRef.current = null;
//     }
//     // set interval tick
//     drainIntervalRef.current = setInterval(() => {
//       setClientBunkers(prev => {
//         const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//         let changed = false;

//         for (let i = 0; i < NUM; i++) {
//           const flow = Number(flows[i] || 0);
//           const bc = Number(bunkerCapacity || 0);
//           if (flow <= 0 || bc <= 0) continue;
//           const totalPct = (next[i].layers || []).reduce((s, L) => s + (Number(L.percent) || 0), 0);
//           if (totalPct <= 0) continue;

//           // percent drained per second across entire bunker
//           // mass flow (tons/sec) = flow (t/h) / 3600
//           // percent/sec = (tons/sec) / bunkerCapacity * 100
//           const percentPerSec = (flow / 3600) / bc * 100; 
//           if (percentPerSec <= 0) continue;

//           // drain top-down: reduce last layer first
//           let toDrain = percentPerSec;
//           while (toDrain > 0 && next[i].layers.length > 0) {
//             const topIdx = next[i].layers.length - 1;
//             const top = next[i].layers[topIdx];
//             const topPct = Number(top.percent) || 0;
//             const drainAmt = Math.min(topPct, toDrain);
//             if (drainAmt > 0) {
//               next[i].layers[topIdx] = { ...top, percent: Math.max(0, Number((topPct - drainAmt).toFixed(6))) };
//               changed = true;
//               toDrain -= drainAmt;
//             } else {
//               // nothing to drain from top layer -> remove it
//               next[i].layers.pop();
//               changed = true;
//             }
//             // if top layer reached 0, pop it
//             if (next[i].layers[topIdx] && Number(next[i].layers[topIdx].percent) <= 0) {
//               next[i].layers.splice(topIdx, 1);
//             }
//           }
//         }

//         // if nothing changed return previous to avoid re-render
//         return changed ? next : prev;
//       });
//     }, 1000);

//     return () => {
//       if (drainIntervalRef.current) {
//         clearInterval(drainIntervalRef.current);
//         drainIntervalRef.current = null;
//       }
//     };
//   }, [flows, bunkerCapacity]); // restart interval when flows or capacity change

//   // helper to set bunkerCapacity and generation
//   return (
//     <div>
//       <div className="navbar">
//         <h1>Coal Blend Dashboard</h1>
//         <div className="nav-buttons">
//           {/* debug button optional */}
//         </div>
//       </div>

//       <Sidebar unit={unit} setUnit={setUnit} />

//       <div className="input-section" style={{ marginTop: 'calc(var(--navbar-height) + 8px)' }}>
//         <div>
//           <label>Bunker capacity</label><br />
//           <input className="input-box" type="number" value={bunkerCapacity || ''} onChange={(e)=> setBunkerCapacity(Number(e.target.value)||0)} />
//         </div>
//         <div>
//           <label>Generation</label><br />
//           <input className="input-box" type="number" value={generation || ''} onChange={(e)=> setGeneration(Number(e.target.value)||0)} />
//         </div>
//       </div>

//       <main className="main-container" style={{ marginTop: 16 }}>
//         <div className="diagram-and-mills" style={{ width: '100%' }}>
//           <div className="bunker-wrapper">
//             <BunkerDiagram
//               clientBunkers={clientBunkers}
//               addBunkerLayer={addBunkerLayer}
//               removeTopLayer={removeTopLayer}
//               bunkerCapacity={bunkerCapacity}
//             />
//           </div>

//           <div className="spacer" />

//           {/* Coal Flow row (label + 8 inputs) */}
//           <div className="row-label">Coal Flow</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'flow-'+i} className="row-box" style={{ gridColumn: `${i+2}` }}>
//               <input className="flow-input" value={flows[i] || ''} onChange={(e) => updateFlow(i, e.target.value)} placeholder="TPH" />
//             </div>
//           ))}

//           {/* Next Timer row */}
//           <div className="row-label row-next-timer">Next Timer</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'timer-'+i} className="row-box row-next-timer" style={{ gridColumn: `${i+2}` }}>
//               <input className="timer-input" readOnly value={timersSeconds[i] ? secondsToHHMMSS(timersSeconds[i]) : '--'} />
//             </div>
//           ))}

//           {/* Total Percent row */}
//           <div className="row-label row-total-percent">Total %</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'total-'+i} className="row-box row-total-percent" style={{ gridColumn: `${i+2}` }}>
//               <input className="total-input" readOnly value={(Number(totals[i]||0)).toFixed(2) + '%'} />
//             </div>
//           ))}

//         </div>
//       </main>
//     </div>
//   );
// }
// src/App.jsx
// src/App.jsx
// import React, { useEffect, useMemo, useState, useRef } from 'react';
// import Sidebar from './components/Sidebar';
// import BunkerDiagram from './components/BunkerDiagram';
// import Toasts from './components/Toast';
// import api from './api/apiClient';

// function secondsToHHMMSS(secondsRaw) {
//   if (!isFinite(secondsRaw) || secondsRaw === null) return '--';
//   const s = Math.max(0, Math.round(secondsRaw));
//   const h = Math.floor(s / 3600);
//   const m = Math.floor((s % 3600) / 60);
//   const sec = s % 60;
//   return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
// }

// export default function App() {
//   const NUM = 8;

//   const [unit, setUnit] = useState(1);
//   const [bunkerCapacity, setBunkerCapacity] = useState(1000);
//   const [generation, setGeneration] = useState(0);
//   const [flows, setFlows] = useState(Array(NUM).fill(0));
//   const [clientBunkers, setClientBunkers] = useState(Array.from({ length: NUM }).map(()=>({ layers: [] })));

//   // blendId for current unit
//   const [blendId, setBlendId] = useState(null);

//   // loading/submitting flags
//   const [isLoadingUnit, setIsLoadingUnit] = useState(false);
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   // small toast system
//   const [toasts, setToasts] = useState([]);
//   function pushToast(message, type='success', ttl=3500){
//     const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
//     setToasts(t => [...t, { id, message, type }]);
//     setTimeout(()=> setToasts(t => t.filter(x=>x.id !== id)), ttl);
//   }

//   // ========== Prefetch & cache ==========
//   // unitsCache: { 1: snapshotObj|null, 2:..., 3:... }
//   const [unitsCache, setUnitsCache] = useState({1:null,2:null,3:null});

//   // Prefetch all units at mount (in parallel) to make switching instant
//   useEffect(() => {
//     let cancelled = false;
//     async function prefetchAll(){
//       try {
//         const promises = [1,2,3].map(u => api.getUnit(u).catch(() => null));
//         const results = await Promise.all(promises);
//         if (cancelled) return;
//         const next = {1:null,2:null,3:null};
//         results.forEach((r, idx) => { next[idx+1] = r && r.doc && r.doc.snapshot ? r.doc.snapshot : (r && r.blend ? r.blend : null); });
//         setUnitsCache(prev => ({ ...prev, ...next }));
//         // if current unit has a snapshot in cache, apply it immediately
//         const snapshot = next[unit];
//         if (snapshot) applySnapshotToUI(snapshot);
//       } catch (e) {
//         console.error('prefetchAll error', e);
//       }
//     }
//     prefetchAll();
//     return () => { cancelled = true; };
//   }, []); // run once

//   // On unit change: apply cached snapshot immediately if present, then refresh in background
//   useEffect(() => {
//     let cancelled = false;
//     async function loadAndMaybeRefresh(u){
//       setIsLoadingUnit(true);
//       // apply cache first if present
//       const cached = unitsCache[u];
//       if (cached) {
//         applySnapshotToUI(cached);
//         setIsLoadingUnit(false);
//       } else {
//         // if not cached, show loading spinner state and wait for fetch
//         setIsLoadingUnit(true);
//       }

//       // Always try to fetch latest in background and update cache + UI if changed
//       try {
//         const fresh = await api.getUnit(u).catch(()=>null);
//         if (cancelled) return;
//         const snapshot = fresh && fresh.doc && fresh.doc.snapshot ? fresh.doc.snapshot : (fresh && fresh.blend ? fresh.blend : null);
//         if (snapshot) {
//           // update cache and apply only if not identical (or if no cached)
//           setUnitsCache(prev => {
//             const old = prev[u];
//             const same = JSON.stringify(old) === JSON.stringify(snapshot);
//             if (!same) {
//               // if the user already switched to this unit and cache differs, update UI
//               if (u === unit) applySnapshotToUI(snapshot);
//               return { ...prev, [u]: snapshot };
//             }
//             return prev;
//           });
//         }
//       } catch (err) {
//         console.warn('background refresh failed for unit', u, err);
//       } finally {
//         // if we had no cached snapshot previously, stop loading indicator
//         if (!cached) setIsLoadingUnit(false);
//       }
//     }

//     loadAndMaybeRefresh(unit);

//     return () => { cancelled = true; };
//   }, [unit, unitsCache]); // unitsCache included so if prefetch fills it we apply instantly

//   // Apply a `snapshot` (from server unit doc or blend) into UI state
//   function applySnapshotToUI(snapshot) {
//     // snapshot may be either doc.snapshot or blend object; adapt fields
//     const flowsArr = Array.isArray(snapshot.flows) ? snapshot.flows : (snapshot.flows || Array(NUM).fill(0));
//     const bc = Number(snapshot.bunkerCapacity || snapshot.bunker_capacity || 0);
//     const gen = Number(snapshot.generation || 0);
//     let cbunks = Array.from({ length: NUM }).map(()=>({ layers: [] }));
//     if (Array.isArray(snapshot.clientBunkers) && snapshot.clientBunkers.length) {
//       cbunks = Array.from({ length: NUM }).map((_, i) => {
//         const b = snapshot.clientBunkers[i] || { layers: [] };
//         return { layers: (b.layers || []).map(l => ({ ...l })) };
//       });
//     } else if (Array.isArray(snapshot.bunkers) && snapshot.bunkers.length) {
//       cbunks = Array.from({ length: NUM }).map((_, i) => {
//         const b = snapshot.bunkers[i] || { layers: [] };
//         return { layers: (b.layers || []).map(l => ({ ...l })) };
//       });
//     }
//     setFlows(flowsArr.map(v => Number(v || 0)));
//     setBunkerCapacity(bc);
//     setGeneration(gen);
//     setClientBunkers(cbunks);
//     // try to set blendId if present (doc.blendId or blend._id)
//     if (snapshot && snapshot._id) setBlendId(String(snapshot._id));
//     else if (snapshot && snapshot.blendId) setBlendId(String(snapshot.blendId));
//     else setBlendId(prev => prev); // keep existing if none in snapshot
//   }

//   // ========== core unchanged logic: updateFlow, add/remove layer, totals, timers, drain ==========
//   function updateFlow(i, v) {
//     const val = Number(v) || 0;
//     setFlows(prev => {
//       const next = Array.isArray(prev) ? [...prev] : Array(NUM).fill(0);
//       next[i] = val;
//       return next;
//     });
//   }
//   function addBunkerLayer(bunkerIndex, layer) {
//     setClientBunkers(prev => {
//       const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//       next[bunkerIndex].layers.push(layer);
//       return next;
//     });
//   }
//   function removeTopLayer(bunkerIndex) {
//     setClientBunkers(prev => {
//       const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//       if (next[bunkerIndex].layers.length > 0) next[bunkerIndex].layers.pop();
//       return next;
//     });
//   }

//   const totals = useMemo(() => {
//     return clientBunkers.map(b => (b.layers||[]).reduce((s,L)=> s + (Number(L.percent)||0),0));
//   }, [clientBunkers]);

//   const timersSeconds = useMemo(() => {
//     return totals.map((totalPct, idx) => {
//       const flow = Number(flows[idx] || 0);
//       const bc = Number(bunkerCapacity || 0);
//       if (totalPct <= 0 || bc <= 0 || flow <= 0) return null;
//       const hours = (totalPct / 100) * bc / flow;
//       return Math.max(0, hours * 3600);
//     });
//   }, [totals, flows, bunkerCapacity]);

//   const drainIntervalRef = useRef(null);
//   useEffect(() => {
//     if (drainIntervalRef.current) {
//       clearInterval(drainIntervalRef.current);
//       drainIntervalRef.current = null;
//     }
//     drainIntervalRef.current = setInterval(() => {
//       setClientBunkers(prev => {
//         const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//         let changed = false;
//         for (let i=0;i<NUM;i++){
//           const flow=Number(flows[i]||0);
//           const bc=Number(bunkerCapacity||0);
//           if (flow<=0||bc<=0) continue;
//           const totalPct = (next[i].layers||[]).reduce((s,L)=>s+(Number(L.percent)||0),0);
//           if (totalPct<=0) continue;
//           const percentPerSec = (flow/3600)/bc*100;
//           if (percentPerSec<=0) continue;
//           // bottom-first drain
//           let toDrain = percentPerSec;
//           while (toDrain>0 && next[i].layers.length>0) {
//             const bottom = next[i].layers[0];
//             const bottomPct = Number(bottom.percent)||0;
//             const drainAmt = Math.min(bottomPct, toDrain);
//             if (drainAmt>0) {
//               next[i].layers[0] = { ...bottom, percent: Math.max(0, Number((bottomPct - drainAmt).toFixed(6))) };
//               changed = true;
//               toDrain -= drainAmt;
//             } else {
//               next[i].layers.shift();
//               changed = true;
//             }
//             if (next[i].layers[0] && Number(next[i].layers[0].percent)<=0) next[i].layers.shift();
//           }
//         }
//         return changed ? next : prev;
//       });
//     }, 1000);
//     return () => { if (drainIntervalRef.current) { clearInterval(drainIntervalRef.current); drainIntervalRef.current=null; } };
//   }, [flows, bunkerCapacity]);

//   // ========== Submit logic: optimistic update + server submit via api.submitUnit ==========
//   async function handleSubmit(){
//     const payload = {
//       rows: [], // supply rows if you have them in UI
//       flows,
//       generation,
//       bunkerCapacity,
//       bunkerCapacities: Array(NUM).fill(0),
//       clientBunkers,
//       coalColorMap: (typeof window !== 'undefined' && window.COAL_COLOR_MAP) ? window.COAL_COLOR_MAP : {}
//     };

//     setIsSubmitting(true);
//     try {
//       // Use api.submitUnit which first tries /api/submit/:unit or falls back to create+map
//       const res = await api.submitUnit(unit, payload);
//       // res shape varies depending on server; try to extract blendId
//       let newId = null;
//       if (res) {
//         newId = res.id || res.blendId || (res.created && (res.created.id || res.created._id)) || (res.mapped && res.mapped.blendId) || null;
//       }
//       // optimistic: update cache and UI immediately
//       const snapshotForCache = {
//         flows, generation, bunkerCapacity, clientBunkers,
//         // keep metrics short; server will provide canonical metrics on background refresh
//       };
//       setUnitsCache(prev => ({ ...prev, [unit]: snapshotForCache }));
//       setBlendId(newId || blendId);
//       pushToast(`Unit ${unit} submitted`, 'success');

//       // background refresh the unit from server to get canonical snapshot & metrics
//       (async () => {
//         try {
//           const fresh = await api.getUnit(unit).catch(()=>null);
//           if (fresh) {
//             const snap = fresh.doc && fresh.doc.snapshot ? fresh.doc.snapshot : (fresh.blend ? fresh.blend : null);
//             if (snap) {
//               setUnitsCache(prev => ({ ...prev, [unit]: snap }));
//               if (unit === Number(unit)) applySnapshotToUI(snap);
//               if (snap._id) setBlendId(String(snap._id));
//             }
//           }
//         } catch (err) {
//           console.warn('post-submit background refresh failed', err);
//         }
//       })();

//     } catch (err) {
//       console.error('submit error', err);
//       pushToast('Submit failed — see console', 'error');
//     } finally {
//       setIsSubmitting(false);
//     }
//   }

//   // ---------- UI (kept same layout/logic) ----------
//   return (
//     <div>
//       <div className="navbar">
//         <h1>Coal Blend Dashboard</h1>
//       </div>

//       <Sidebar unit={unit} setUnit={(u) => setUnit(u)} />

//       <div className="input-section" style={{ marginTop: 'calc(var(--navbar-height) + 8px)' }}>
//         <div>
//           <label>Bunker capacity</label><br />
//           <input className="input-box" type="number" value={bunkerCapacity || ''} onChange={(e)=> setBunkerCapacity(Number(e.target.value)||0)} />
//         </div>
//         <div>
//           <label>Generation</label><br />
//           <input className="input-box" type="number" value={generation || ''} onChange={(e)=> setGeneration(Number(e.target.value)||0)} />
//         </div>

//         <div style={{ display: 'flex', alignItems: 'end', marginLeft: 8 }}>
//           <button id="submitBtn" onClick={handleSubmit} disabled={isSubmitting || isLoadingUnit}>
//             { isSubmitting ? 'Submitting...' : `Submit (Unit ${unit})` }
//           </button>
//         </div>
//       </div>

//       <main className="main-container" style={{ marginTop: 16 }}>
//         <div className="diagram-and-mills" style={{ width: '100%' }}>
//           <div className="bunker-wrapper">
//             <BunkerDiagram
//               clientBunkers={clientBunkers}
//               addBunkerLayer={addBunkerLayer}
//               removeTopLayer={removeTopLayer}
//               bunkerCapacity={bunkerCapacity}
//             />
//           </div>

//           <div className="spacer" />

//           <div className="row-label">Coal Flow</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'flow-'+i} className="row-box" style={{ gridColumn: `${i+2}` }}>
//               <input className="flow-input" value={flows[i] || ''} onChange={(e) => updateFlow(i, e.target.value)} placeholder="TPH" />
//             </div>
//           ))}

//           <div className="row-label row-next-timer">Next Timer</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'timer-'+i} className="row-box row-next-timer" style={{ gridColumn: `${i+2}` }}>
//               <input className="timer-input" readOnly value={timersSeconds[i] ? secondsToHHMMSS(timersSeconds[i]) : '--'} />
//             </div>
//           ))}

//           <div className="row-label row-total-percent">Total %</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'total-'+i} className="row-box row-total-percent" style={{ gridColumn: `${i+2}` }}>
//               <input className="total-input" readOnly value={(Number(totals[i]||0)).toFixed(2) + '%'} />
//             </div>
//           ))}

//         </div>
//       </main>

//       <Toasts toasts={toasts} removeToast={(id)=> setToasts(prev => prev.filter(t => t.id !== id))} />
//     </div>
//   );
// }
// src/App.jsx
// import React, { useEffect, useMemo, useState, useRef } from 'react';
// import Sidebar from './components/Sidebar';
// import BunkerDiagram from './components/BunkerDiagram';
// import Toasts from './components/Toast';
// import api from './api/apiClient';

// function secondsToHHMMSS(secondsRaw) {
//   if (!isFinite(secondsRaw) || secondsRaw === null) return '--';
//   const s = Math.max(0, Math.round(secondsRaw));
//   const h = Math.floor(s / 3600);
//   const m = Math.floor((s % 3600) / 60);
//   const sec = s % 60;
//   return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
// }

// export default function App() {
//   const NUM = 8;

//   const [unit, setUnit] = useState(1);
//   const [bunkerCapacity, setBunkerCapacity] = useState(1000);
//   const [generation, setGeneration] = useState(0);
//   const [flows, setFlows] = useState(Array(NUM).fill(0));
//   const [clientBunkers, setClientBunkers] = useState(Array.from({ length: NUM }).map(()=>({ layers: [] })));

//   // blendId for current unit
//   const [blendId, setBlendId] = useState(null);

//   // loading/submitting flags
//   const [isLoadingUnit, setIsLoadingUnit] = useState(false);
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   // small toast system
//   const [toasts, setToasts] = useState([]);
//   function pushToast(message, type='success', ttl=3500){
//     const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
//     setToasts(t => [...t, { id, message, type }]);
//     setTimeout(()=> setToasts(t => t.filter(x=>x.id !== id)), ttl);
//   }

//   // ========== Prefetch & cache ==========
//   const [unitsCache, setUnitsCache] = useState({1:null,2:null,3:null});

//   useEffect(() => {
//     let cancelled = false;
//     async function prefetchAll(){
//       try {
//         const promises = [1,2,3].map(u => api.getUnit(u).catch(() => null));
//         const results = await Promise.all(promises);
//         if (cancelled) return;
//         const next = {1:null,2:null,3:null};
//         results.forEach((r, idx) => { next[idx+1] = r && r.doc && r.doc.snapshot ? r.doc.snapshot : (r && r.blend ? r.blend : null); });
//         setUnitsCache(prev => ({ ...prev, ...next }));
//         const snapshot = next[unit];
//         if (snapshot) applySnapshotToUI(snapshot);
//       } catch (e) {
//         console.error('prefetchAll error', e);
//       }
//     }
//     prefetchAll();
//     return () => { cancelled = true; };
//   }, []); // run once

//   useEffect(() => {
//     let cancelled = false;
//     async function loadAndMaybeRefresh(u){
//       setIsLoadingUnit(true);
//       const cached = unitsCache[u];
//       if (cached) {
//         applySnapshotToUI(cached);
//         setIsLoadingUnit(false);
//       } else {
//         setIsLoadingUnit(true);
//       }

//       try {
//         const fresh = await api.getUnit(u).catch(()=>null);
//         if (cancelled) return;
//         const snapshot = fresh && fresh.doc && fresh.doc.snapshot ? fresh.doc.snapshot : (fresh && fresh.blend ? fresh.blend : null);
//         if (snapshot) {
//           setUnitsCache(prev => {
//             const old = prev[u];
//             const same = JSON.stringify(old) === JSON.stringify(snapshot);
//             if (!same) {
//               if (u === unit) applySnapshotToUI(snapshot);
//               return { ...prev, [u]: snapshot };
//             }
//             return prev;
//           });
//         }
//       } catch (err) {
//         console.warn('background refresh failed for unit', u, err);
//       } finally {
//         if (!cached) setIsLoadingUnit(false);
//       }
//     }

//     loadAndMaybeRefresh(unit);

//     return () => { cancelled = true; };
//   }, [unit, unitsCache]); // unitsCache included so if prefetch fills it we apply instantly

//   function applySnapshotToUI(snapshot) {
//     const flowsArr = Array.isArray(snapshot.flows) ? snapshot.flows : (snapshot.flows || Array(NUM).fill(0));
//     const bc = Number(snapshot.bunkerCapacity || snapshot.bunker_capacity || 0);
//     const gen = Number(snapshot.generation || 0);
//     let cbunks = Array.from({ length: NUM }).map(()=>({ layers: [] }));
//     if (Array.isArray(snapshot.clientBunkers) && snapshot.clientBunkers.length) {
//       cbunks = Array.from({ length: NUM }).map((_, i) => {
//         const b = snapshot.clientBunkers[i] || { layers: [] };
//         return { layers: (b.layers || []).map(l => ({ ...l })) };
//       });
//     } else if (Array.isArray(snapshot.bunkers) && snapshot.bunkers.length) {
//       cbunks = Array.from({ length: NUM }).map((_, i) => {
//         const b = snapshot.bunkers[i] || { layers: [] };
//         return { layers: (b.layers || []).map(l => ({ ...l })) };
//       });
//     }
//     setFlows(flowsArr.map(v => Number(v || 0)));
//     setBunkerCapacity(bc);
//     setGeneration(gen);
//     setClientBunkers(cbunks);
//     if (snapshot && snapshot._id) setBlendId(String(snapshot._id));
//     else if (snapshot && snapshot.blendId) setBlendId(String(snapshot.blendId));
//     else setBlendId(prev => prev);
//   }

//   // ========== core logic ==========
//   function updateFlow(i, v) {
//     const val = Number(v) || 0;
//     setFlows(prev => {
//       const next = Array.isArray(prev) ? [...prev] : Array(NUM).fill(0);
//       next[i] = val;
//       return next;
//     });
//   }
//   function addBunkerLayer(bunkerIndex, layer) {
//     setClientBunkers(prev => {
//       const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//       next[bunkerIndex].layers.push(layer);
//       return next;
//     });
//   }
//   function removeTopLayer(bunkerIndex) {
//     setClientBunkers(prev => {
//       const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//       if (next[bunkerIndex].layers.length > 0) next[bunkerIndex].layers.pop();
//       return next;
//     });
//   }

//   const totals = useMemo(() => {
//     return clientBunkers.map(b => (b.layers||[]).reduce((s,L)=> s + (Number(L.percent)||0),0));
//   }, [clientBunkers]);

//   const timersSeconds = useMemo(() => {
//     return totals.map((totalPct, idx) => {
//       const flow = Number(flows[idx] || 0);
//       const bc = Number(bunkerCapacity || 0);
//       if (totalPct <= 0 || bc <= 0 || flow <= 0) return null;
//       const hours = (totalPct / 100) * bc / flow;
//       return Math.max(0, hours * 3600);
//     });
//   }, [totals, flows, bunkerCapacity]);

//   // Drain interval: bottom-first draining (index 0 = bottom)
//   const drainIntervalRef = useRef(null);
//   useEffect(() => {
//     if (drainIntervalRef.current) {
//       clearInterval(drainIntervalRef.current);
//       drainIntervalRef.current = null;
//     }
//     drainIntervalRef.current = setInterval(() => {
//       setClientBunkers(prev => {
//         const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//         let changed = false;
//         for (let i=0;i<NUM;i++){
//           const flow=Number(flows[i]||0);
//           const bc=Number(bunkerCapacity||0);
//           if (flow<=0||bc<=0) continue;
//           const totalPct = (next[i].layers||[]).reduce((s,L)=>s+(Number(L.percent)||0),0);
//           if (totalPct<=0) continue;
//           const percentPerSec = (flow/3600)/bc*100;
//           if (percentPerSec<=0) continue;
//           // bottom-first drain
//           let toDrain = percentPerSec;
//           while (toDrain>0 && next[i].layers.length>0) {
//             // bottom layer is at index 0
//             const bottom = next[i].layers[0];
//             const bottomPct = Number(bottom.percent)||0;
//             const drainAmt = Math.min(bottomPct, toDrain);
//             if (drainAmt>0) {
//               // reduce bottom layer percent
//               // keep precision reasonable
//               next[i].layers[0] = { ...bottom, percent: Math.max(0, Number((bottomPct - drainAmt).toFixed(6))) };
//               changed = true;
//               toDrain -= drainAmt;
//             } else {
//               // if bottom had 0 (edge case), remove it
//               next[i].layers.shift();
//               changed = true;
//             }
//             // if after reduction the bottom is <= 0, remove it
//             if (next[i].layers[0] && Number(next[i].layers[0].percent) <= 0) {
//               next[i].layers.shift();
//             }
//           }
//         }
//         return changed ? next : prev;
//       });
//     }, 1000);
//     return () => { if (drainIntervalRef.current) { clearInterval(drainIntervalRef.current); drainIntervalRef.current=null; } };
//   }, [flows, bunkerCapacity]);

//   // ========== Submit logic ==========
//   async function handleSubmit(){
//     const payload = {
//       rows: [],
//       flows,
//       generation,
//       bunkerCapacity,
//       bunkerCapacities: Array(NUM).fill(0),
//       clientBunkers,
//       coalColorMap: (typeof window !== 'undefined' && window.COAL_COLOR_MAP) ? window.COAL_COLOR_MAP : {}
//     };

//     setIsSubmitting(true);
//     try {
//       const res = await api.submitUnit(unit, payload);
//       let newId = null;
//       if (res) {
//         newId = res.id || res.blendId || (res.created && (res.created.id || res.created._id)) || (res.mapped && res.mapped.blendId) || null;
//       }
//       const snapshotForCache = { flows, generation, bunkerCapacity, clientBunkers };
//       setUnitsCache(prev => ({ ...prev, [unit]: snapshotForCache }));
//       setBlendId(newId || blendId);
//       pushToast(`Unit ${unit} submitted`, 'success');

//       (async () => {
//         try {
//           const fresh = await api.getUnit(unit).catch(()=>null);
//           if (fresh) {
//             const snap = fresh.doc && fresh.doc.snapshot ? fresh.doc.snapshot : (fresh.blend ? fresh.blend : null);
//             if (snap) {
//               setUnitsCache(prev => ({ ...prev, [unit]: snap }));
//               if (unit === Number(unit)) applySnapshotToUI(snap);
//               if (snap._id) setBlendId(String(snap._id));
//             }
//           }
//         } catch (err) {
//           console.warn('post-submit background refresh failed', err);
//         }
//       })();

//     } catch (err) {
//       console.error('submit error', err);
//       pushToast('Submit failed — see console', 'error');
//     } finally {
//       setIsSubmitting(false);
//     }
//   }

//   // ---------- UI ----------
//   const BLINK_THRESHOLD = 3 * 3600; // 3 hours in seconds

//   return (
//     <div>
//       <div className="navbar">
//         <h1>Coal Blend Dashboard</h1>
//       </div>

//       <Sidebar unit={unit} setUnit={(u) => setUnit(u)} />

//       <div className="input-section" style={{ marginTop: 'calc(var(--navbar-height) + 8px)' }}>
//         <div>
//           <label>Bunker capacity</label><br />
//           <input className="input-box" type="number" value={bunkerCapacity || ''} onChange={(e)=> setBunkerCapacity(Number(e.target.value)||0)} />
//         </div>
//         <div>
//           <label>Generation</label><br />
//           <input className="input-box" type="number" value={generation || ''} onChange={(e)=> setGeneration(Number(e.target.value)||0)} />
//         </div>

//         <div style={{ display: 'flex', alignItems: 'end', marginLeft: 8 }}>
//           <button id="submitBtn" onClick={handleSubmit} disabled={isSubmitting || isLoadingUnit}>
//             { isSubmitting ? 'Submitting...' : `Submit (Unit ${unit})` }
//           </button>
//         </div>
//       </div>

//       <main className="main-container" style={{ marginTop: 16 }}>
//         <div className="diagram-and-mills" style={{ width: '100%' }}>
//           <div className="bunker-wrapper">
//             <BunkerDiagram
//               clientBunkers={clientBunkers}
//               addBunkerLayer={addBunkerLayer}
//               removeTopLayer={removeTopLayer}
//               bunkerCapacity={bunkerCapacity}
//             />
//           </div>

//           <div className="spacer" />

//           <div className="row-label">Coal Flow</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'flow-'+i} className="row-box" style={{ gridColumn: `${i+2}` }}>
//               <input className="flow-input" value={flows[i] || ''} onChange={(e) => updateFlow(i, e.target.value)} placeholder="TPH" />
//             </div>
//           ))}

//           <div className="row-label row-next-timer">Next Timer</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'timer-'+i} className="row-box row-next-timer" style={{ gridColumn: `${i+2}` }}>
//               <input
//                 className={`timer-input ${timersSeconds[i] && timersSeconds[i] > 0 && timersSeconds[i] <= BLINK_THRESHOLD ? 'timer-warning' : ''}`}
//                 readOnly
//                 value={timersSeconds[i] ? secondsToHHMMSS(timersSeconds[i]) : '--'}
//               />
//             </div>
//           ))}

//           <div className="row-label row-total-percent">Total %</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'total-'+i} className="row-box row-total-percent" style={{ gridColumn: `${i+2}` }}>
//               <input className="total-input" readOnly value={(Number(totals[i]||0)).toFixed(2) + '%'} />
//             </div>
//           ))}

//         </div>
//       </main>

//       <Toasts toasts={toasts} removeToast={(id)=> setToasts(prev => prev.filter(t => t.id !== id))} />
//     </div>
//   );
// }



// // src/App.jsx
// import React, { useEffect, useMemo, useState, useRef } from 'react';
// import Sidebar from './components/Sidebar';
// import BunkerDiagram from './components/BunkerDiagram';
// import Toasts from './components/Toast';
// import api from './api/apiClient';

// function secondsToHHMMSS(secondsRaw) {
//   if (!isFinite(secondsRaw) || secondsRaw === null) return '--';
//   const s = Math.max(0, Math.round(secondsRaw));
//   const h = Math.floor(s / 3600);
//   const m = Math.floor((s % 3600) / 60);
//   const sec = s % 60;
//   return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
// }

// export default function App() {
//   const NUM = 8;

//   const [unit, setUnit] = useState(1);
//   const [bunkerCapacity, setBunkerCapacity] = useState(1000);
//   const [generation, setGeneration] = useState(0);
//   const [flows, setFlows] = useState(Array(NUM).fill(0));
//   const [clientBunkers, setClientBunkers] = useState(Array.from({ length: NUM }).map(()=>({ layers: [] })));

//   const [blendId, setBlendId] = useState(null);
//   const [isLoadingUnit, setIsLoadingUnit] = useState(false);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [toasts, setToasts] = useState([]);
//   function pushToast(message, type='success', ttl=3500){
//     const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
//     setToasts(t => [...t, { id, message, type }]);
//     setTimeout(()=> setToasts(t => t.filter(x=>x.id !== id)), ttl);
//   }

//   const [unitsCache, setUnitsCache] = useState({1:null,2:null,3:null});

//   useEffect(() => { api.getCoals().catch(()=>[]); }, []);

//   // Prefetch
//   useEffect(() => {
//     let cancelled = false;
//     async function prefetchAll(){
//       try {
//         const promises = [1,2,3].map(u => api.getUnit(u).catch(() => null));
//         const results = await Promise.all(promises);
//         if (cancelled) return;
//         const next = {1:null,2:null,3:null};
//         results.forEach((r, idx) => { next[idx+1] = r && r.doc && r.doc.snapshot ? r.doc.snapshot : (r && r.blend ? r.blend : null); });
//         setUnitsCache(prev => ({ ...prev, ...next }));
//         const snapshot = next[unit];
//         if (snapshot) applySnapshotToUI(snapshot);
//       } catch (e) {
//         console.error('prefetchAll error', e);
//       }
//     }
//     prefetchAll();
//     return () => { cancelled = true; };
//   }, []);

//   // On unit change: apply cached snapshot immediately if present, then refresh
//   useEffect(() => {
//     let cancelled = false;
//     async function loadAndMaybeRefresh(u){
//       setIsLoadingUnit(true);
//       const cached = unitsCache[u];
//       if (cached) {
//         applySnapshotToUI(cached);
//         setIsLoadingUnit(false);
//       } else {
//         setIsLoadingUnit(true);
//       }

//       try {
//         const fresh = await api.getUnit(u).catch(()=>null);
//         if (cancelled) return;
//         const snapshot = fresh && fresh.doc && fresh.doc.snapshot ? fresh.doc.snapshot : (fresh && fresh.blend ? fresh.blend : null);
//         if (snapshot) {
//           setUnitsCache(prev => {
//             const old = prev[u];
//             const same = JSON.stringify(old) === JSON.stringify(snapshot);
//             if (!same) {
//               if (u === unit) applySnapshotToUI(snapshot);
//               return { ...prev, [u]: snapshot };
//             }
//             return prev;
//           });
//         }
//       } catch (err) {
//         console.warn('background refresh failed for unit', u, err);
//       } finally {
//         if (!cached) setIsLoadingUnit(false);
//       }
//     }

//     loadAndMaybeRefresh(unit);
//     return () => { cancelled = true; };
//   }, [unit, unitsCache]);

//   function applySnapshotToUI(snapshot) {
//     const flowsArr = Array.isArray(snapshot.flows) ? snapshot.flows : (snapshot.flows || Array(NUM).fill(0));
//     const bc = Number(snapshot.bunkerCapacity || snapshot.bunker_capacity || 0);
//     const gen = Number(snapshot.generation || 0);
//     let cbunks = Array.from({ length: NUM }).map(()=>({ layers: [] }));
//     if (Array.isArray(snapshot.clientBunkers) && snapshot.clientBunkers.length) {
//       cbunks = Array.from({ length: NUM }).map((_, i) => {
//         const b = snapshot.clientBunkers[i] || { layers: [] };
//         return { layers: (b.layers || []).map(l => ({ ...l })) };
//       });
//     } else if (Array.isArray(snapshot.bunkers) && snapshot.bunkers.length) {
//       cbunks = Array.from({ length: NUM }).map((_, i) => {
//         const b = snapshot.bunkers[i] || { layers: [] };
//         return { layers: (b.layers || []).map(l => ({ ...l })) };
//       });
//     }
//     setFlows(flowsArr.map(v => Number(v || 0)));
//     setBunkerCapacity(bc);
//     setGeneration(gen);
//     setClientBunkers(cbunks);
//     if (snapshot && snapshot._id) setBlendId(String(snapshot._id));
//     else if (snapshot && snapshot.blendId) setBlendId(String(snapshot.blendId));
//     else setBlendId(prev => prev);
//   }

//   // core functions
//   function updateFlow(i, v) {
//     const val = Number(v) || 0;
//     setFlows(prev => {
//       const next = Array.isArray(prev) ? [...prev] : Array(NUM).fill(0);
//       next[i] = val;
//       return next;
//     });
//   }
//   function addBunkerLayer(bunkerIndex, layer) {
//     setClientBunkers(prev => {
//       const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//       next[bunkerIndex].layers.push(layer);
//       return next;
//     });
//   }
//   function removeTopLayer(bunkerIndex) {
//     setClientBunkers(prev => {
//       const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//       if (next[bunkerIndex].layers.length > 0) next[bunkerIndex].layers.pop();
//       return next;
//     });
//   }

//   const totals = useMemo(() => {
//     return clientBunkers.map(b => (b.layers||[]).reduce((s,L)=> s + (Number(L.percent)||0),0));
//   }, [clientBunkers]);

//   const timersSeconds = useMemo(() => {
//     return totals.map((totalPct, idx) => {
//       const flow = Number(flows[idx] || 0);
//       const bc = Number(bunkerCapacity || 0);
//       if (totalPct <= 0 || bc <= 0 || flow <= 0) return null;
//       const hours = (totalPct / 100) * bc / flow;
//       return Math.max(0, hours * 3600);
//     });
//   }, [totals, flows, bunkerCapacity]);

//   // bottom-first drain
//   const drainIntervalRef = useRef(null);
//   useEffect(() => {
//     if (drainIntervalRef.current) {
//       clearInterval(drainIntervalRef.current);
//       drainIntervalRef.current = null;
//     }
//     drainIntervalRef.current = setInterval(() => {
//       setClientBunkers(prev => {
//         const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//         let changed = false;
//         for (let i=0;i<NUM;i++){
//           const flow=Number(flows[i]||0);
//           const bc=Number(bunkerCapacity||0);
//           if (flow<=0||bc<=0) continue;
//           const totalPct = (next[i].layers||[]).reduce((s,L)=>s+(Number(L.percent)||0),0);
//           if (totalPct<=0) continue;
//           const percentPerSec = (flow/3600)/bc*100;
//           if (percentPerSec<=0) continue;
//           let toDrain = percentPerSec;
//           while (toDrain>0 && next[i].layers.length>0) {
//             const bottom = next[i].layers[0];
//             const bottomPct = Number(bottom.percent)||0;
//             const drainAmt = Math.min(bottomPct, toDrain);
//             if (drainAmt>0) {
//               next[i].layers[0] = { ...bottom, percent: Math.max(0, Number((bottomPct - drainAmt).toFixed(6))) };
//               changed = true;
//               toDrain -= drainAmt;
//             } else {
//               next[i].layers.shift();
//               changed = true;
//             }
//             if (next[i].layers[0] && Number(next[i].layers[0].percent) <= 0) {
//               next[i].layers.shift();
//             }
//           }
//         }
//         return changed ? next : prev;
//       });
//     }, 1000);
//     return () => { if (drainIntervalRef.current) { clearInterval(drainIntervalRef.current); drainIntervalRef.current=null; } };
//   }, [flows, bunkerCapacity]);

//   // ---------- Submit logic (now includes clientSavedAt + clientTz) ----------
//   async function handleSubmit(){
//     const payload = {
//       rows: [], // add rows if available in UI
//       flows,
//       generation,
//       bunkerCapacity,
//       bunkerCapacities: Array(NUM).fill(0),
//       clientBunkers,
//       coalColorMap: (typeof window !== 'undefined' && window.COAL_COLOR_MAP) ? window.COAL_COLOR_MAP : {},
//       clientSavedAt: new Date().toISOString(),
//       clientTz: (typeof Intl !== 'undefined' && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions) ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
//     };

//     setIsSubmitting(true);
//     try {
//       const res = await api.submitUnit(unit, payload);
//       let newId = null;
//       if (res) {
//         newId = res.id || res.blendId || (res.created && (res.created.id || res.created._id)) || (res.mapped && res.mapped.blendId) || null;
//       }
//       const snapshotForCache = { flows, generation, bunkerCapacity, clientBunkers };
//       setUnitsCache(prev => ({ ...prev, [unit]: snapshotForCache }));
//       setBlendId(newId || blendId);
//       pushToast(`Unit ${unit} submitted`, 'success');

//       (async () => {
//         try {
//           const fresh = await api.getUnit(unit).catch(()=>null);
//           if (fresh) {
//             const snap = fresh.doc && fresh.doc.snapshot ? fresh.doc.snapshot : (fresh.blend ? fresh.blend : null);
//             if (snap) {
//               setUnitsCache(prev => ({ ...prev, [unit]: snap }));
//               if (unit === Number(unit)) applySnapshotToUI(snap);
//               if (snap._id) setBlendId(String(snap._id));
//             }
//           }
//         } catch (err) {
//           console.warn('post-submit background refresh failed', err);
//         }
//       })();

//     } catch (err) {
//       console.error('submit error', err);
//       pushToast('Submit failed — see console', 'error');
//     } finally {
//       setIsSubmitting(false);
//     }
//   }

//   // ---------- UI ----------
//   const BLINK_THRESHOLD = 3 * 3600; // 3 hours in seconds

//   return (
//     <div>
//       <div className="navbar">
//         <h1>Coal Blend Dashboard</h1>
//       </div>

//       <Sidebar unit={unit} setUnit={(u) => setUnit(u)} />

//       <div className="input-section" style={{ marginTop: 'calc(var(--navbar-height) + 8px)' }}>
//         <div>
//           <label>Bunker capacity</label><br />
//           <input className="input-box" type="number" value={bunkerCapacity || ''} onChange={(e)=> setBunkerCapacity(Number(e.target.value)||0)} />
//         </div>
//         <div>
//           <label>Generation</label><br />
//           <input className="input-box" type="number" value={generation || ''} onChange={(e)=> setGeneration(Number(e.target.value)||0)} />
//         </div>

//         <div style={{ display: 'flex', alignItems: 'end', marginLeft: 8 }}>
//           <button id="submitBtn" onClick={handleSubmit} disabled={isSubmitting || isLoadingUnit} style={{ background:'#ef4444', color:'#fff', padding:'8px 12px', borderRadius:8, border:'none', cursor:'pointer' }}>
//             { isSubmitting ? 'Submitting...' : `Submit (Unit ${unit})` }
//           </button>
//         </div>
//       </div>

//       <main className="main-container" style={{ marginTop: 16 }}>
//         <div className="diagram-and-mills" style={{ width: '100%' }}>
//           <div className="bunker-wrapper">
//             <BunkerDiagram
//               clientBunkers={clientBunkers}
//               addBunkerLayer={addBunkerLayer}
//               removeTopLayer={removeTopLayer}
//               bunkerCapacity={bunkerCapacity}
//             />
//           </div>

//           <div className="spacer" />

//           <div className="row-label">Coal Flow</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'flow-'+i} className="row-box" style={{ gridColumn: `${i+2}` }}>
//               <input className="flow-input" value={flows[i] || ''} onChange={(e) => updateFlow(i, e.target.value)} placeholder="TPH" />
//             </div>
//           ))}

//           <div className="row-label row-next-timer">Next Timer</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'timer-'+i} className="row-box row-next-timer" style={{ gridColumn: `${i+2}` }}>
//               <input
//                 className={`timer-input ${timersSeconds[i] && timersSeconds[i] > 0 && timersSeconds[i] <= BLINK_THRESHOLD ? 'timer-warning' : ''}`}
//                 readOnly
//                 value={timersSeconds[i] ? secondsToHHMMSS(timersSeconds[i]) : '--'}
//               />
//             </div>
//           ))}

//           <div className="row-label row-total-percent">Total %</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'total-'+i} className="row-box row-total-percent" style={{ gridColumn: `${i+2}` }}>
//               <input className="total-input" readOnly value={(Number(totals[i]||0)).toFixed(2) + '%'} />
//             </div>
//           ))}

//         </div>
//       </main>

//       <Toasts toasts={toasts} removeToast={(id)=> setToasts(prev => prev.filter(t => t.id !== id))} />
//     </div>
//   );
// }
// src/App.jsx
// import React, { useEffect, useMemo, useState, useRef } from 'react';
// import Sidebar from './components/Sidebar';
// import BunkerDiagram from './components/BunkerDiagram';
// import Toasts from './components/Toast';
// import api from './api/apiClient';

// function secondsToHHMMSS(secondsRaw) {
//   if (!isFinite(secondsRaw) || secondsRaw === null) return '--';
//   const s = Math.max(0, Math.round(secondsRaw));
//   const h = Math.floor(s / 3600);
//   const m = Math.floor((s % 3600) / 60);
//   const sec = s % 60;
//   return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
// }

// export default function App() {
//   const NUM = 8;

//   const [unit, setUnit] = useState(1);

//   // keep bunkerCapacity & generation as strings while editing for smoother typing,
//   // conversions to Number happen where needed (timers/submit/etc).
//   const [bunkerCapacity, setBunkerCapacity] = useState(String(1000));
//   const [generation, setGeneration] = useState(String(0));

//   // keep flows as editable strings to allow intermediate typing states
//   const [flows, setFlows] = useState(Array(NUM).fill(''));

//   const [clientBunkers, setClientBunkers] = useState(Array.from({ length: NUM }).map(()=>({ layers: [] })));

//   const [blendId, setBlendId] = useState(null);
//   const [isLoadingUnit, setIsLoadingUnit] = useState(false);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [toasts, setToasts] = useState([]);
//   function pushToast(message, type='success', ttl=3500){
//     const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
//     setToasts(t => [...t, { id, message, type }]);
//     setTimeout(()=> setToasts(t => t.filter(x=>x.id !== id)), ttl);
//   }

//   const [unitsCache, setUnitsCache] = useState({1:null,2:null,3:null});

//   // editing ref: when true, we avoid applying server snapshots to UI
//   const editingRef = useRef(false);
//   // expose globally for child components if they want to toggle it (optional)
//   useEffect(() => {
//     if (typeof window !== 'undefined') window.__APP_EDITING__ = editingRef;
//     return () => { if (typeof window !== 'undefined') delete window.__APP_EDITING__; };
//   }, []);

//   // refs to avoid recreating interval on every flows/bunkerCapacity change
//   const flowsRef = useRef(flows);
//   useEffect(() => { flowsRef.current = flows; }, [flows]);

//   const bunkerCapacityRef = useRef(bunkerCapacity);
//   useEffect(() => { bunkerCapacityRef.current = bunkerCapacity; }, [bunkerCapacity]);

//   useEffect(() => { api.getCoals().catch(()=>[]); }, []);

//   // Prefetch
//   useEffect(() => {
//     let cancelled = false;
//     async function prefetchAll(){
//       try {
//         const promises = [1,2,3].map(u => api.getUnit(u).catch(() => null));
//         const results = await Promise.all(promises);
//         if (cancelled) return;
//         const next = {1:null,2:null,3:null};
//         results.forEach((r, idx) => { next[idx+1] = r && r.doc && r.doc.snapshot ? r.doc.snapshot : (r && r.blend ? r.blend : null); });
//         setUnitsCache(prev => ({ ...prev, ...next }));
//         const snapshot = next[unit];
//         if (snapshot) applySnapshotToUI(snapshot);
//       } catch (e) {
//         console.error('prefetchAll error', e);
//       }
//     }
//     prefetchAll();
//     return () => { cancelled = true; };
//   }, []); // run once

//   // On unit change: apply cached snapshot immediately if present, then refresh
//   useEffect(() => {
//     let cancelled = false;
//     async function loadAndMaybeRefresh(u){
//       setIsLoadingUnit(true);
//       const cached = unitsCache[u];
//       if (cached) {
//         applySnapshotToUI(cached);
//         setIsLoadingUnit(false);
//       } else {
//         setIsLoadingUnit(true);
//       }

//       try {
//         const fresh = await api.getUnit(u).catch(()=>null);
//         if (cancelled) return;
//         const snapshot = fresh && fresh.doc && fresh.doc.snapshot ? fresh.doc.snapshot : (fresh && fresh.blend ? fresh.blend : null);
//         if (snapshot) {
//           setUnitsCache(prev => {
//             const old = prev[u];
//             const same = JSON.stringify(old) === JSON.stringify(snapshot);
//             if (!same) {
//               if (u === unit) applySnapshotToUI(snapshot);
//               return { ...prev, [u]: snapshot };
//             }
//             return prev;
//           });
//         }
//       } catch (err) {
//         console.warn('background refresh failed for unit', u, err);
//       } finally {
//         if (!cached) setIsLoadingUnit(false);
//       }
//     }

//     loadAndMaybeRefresh(unit);
//     return () => { cancelled = true; };
//   }, [unit, unitsCache]);

//   function applySnapshotToUI(snapshot) {
//     // If user is actively editing, don't overwrite their inputs
//     if (editingRef.current) return;

//     const flowsArr = Array.isArray(snapshot.flows) ? snapshot.flows : (snapshot.flows || Array(NUM).fill(0));
//     const bc = Number(snapshot.bunkerCapacity || snapshot.bunker_capacity || 0);
//     const gen = Number(snapshot.generation || 0);
//     let cbunks = Array.from({ length: NUM }).map(()=>({ layers: [] }));
//     if (Array.isArray(snapshot.clientBunkers) && snapshot.clientBunkers.length) {
//       cbunks = Array.from({ length: NUM }).map((_, i) => {
//         const b = snapshot.clientBunkers[i] || { layers: [] };
//         return { layers: (b.layers || []).map(l => ({ ...l })) };
//       });
//     } else if (Array.isArray(snapshot.bunkers) && snapshot.bunkers.length) {
//       cbunks = Array.from({ length: NUM }).map((_, i) => {
//         const b = snapshot.bunkers[i] || { layers: [] };
//         return { layers: (b.layers || []).map(l => ({ ...l })) };
//       });
//     }

//     // convert flows to strings for editable UI
//     setFlows(flowsArr.map(v => (v === '' ? '' : String(Number(v || 0)))));
//     setBunkerCapacity(String(bc));
//     setGeneration(String(gen));
//     setClientBunkers(cbunks);
//     if (snapshot && snapshot._id) setBlendId(String(snapshot._id));
//     else if (snapshot && snapshot.blendId) setBlendId(String(snapshot.blendId));
//     else setBlendId(prev => prev);
//   }

//   // core functions
//   function updateFlow(i, v) {
//     // allow intermediate input states; store as string
//     setFlows(prev => {
//       const next = Array.isArray(prev) ? [...prev] : Array(NUM).fill('');
//       next[i] = (v === '' ? '' : String(v));
//       return next;
//     });
//   }
//   function addBunkerLayer(bunkerIndex, layer) {
//     setClientBunkers(prev => {
//       const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//       next[bunkerIndex].layers.push(layer);
//       return next;
//     });
//   }
//   function removeTopLayer(bunkerIndex) {
//     setClientBunkers(prev => {
//       const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//       if (next[bunkerIndex].layers.length > 0) next[bunkerIndex].layers.pop();
//       return next;
//     });
//   }

//   const totals = useMemo(() => {
//     return clientBunkers.map(b => (b.layers||[]).reduce((s,L)=> s + (Number(L.percent)||0),0));
//   }, [clientBunkers]);

//   const timersSeconds = useMemo(() => {
//     return totals.map((totalPct, idx) => {
//       const flow = Number(flows[idx] || 0);
//       const bc = Number(bunkerCapacity || 0);
//       if (totalPct <= 0 || bc <= 0 || flow <= 0) return null;
//       const hours = (totalPct / 100) * bc / flow;
//       return Math.max(0, hours * 3600);
//     });
//   }, [totals, flows, bunkerCapacity]);

//   // bottom-first drain
//   const drainIntervalRef = useRef(null);
//   useEffect(() => {
//     // single interval that reads from refs to avoid frequent teardown and re-mount
//     if (drainIntervalRef.current) {
//       clearInterval(drainIntervalRef.current);
//       drainIntervalRef.current = null;
//     }
//     drainIntervalRef.current = setInterval(() => {
//       setClientBunkers(prev => {
//         const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
//         let changed = false;
//         for (let i=0;i<NUM;i++){
//           const flow = Number(flowsRef.current[i] || 0);
//           const bc = Number(bunkerCapacityRef.current || 0);
//           if (flow<=0||bc<=0) continue;
//           const totalPct = (next[i].layers||[]).reduce((s,L)=>s+(Number(L.percent)||0),0);
//           if (totalPct<=0) continue;
//           const percentPerSec = (flow/3600)/bc*100;
//           if (percentPerSec<=0) continue;
//           let toDrain = percentPerSec;
//           while (toDrain>0 && next[i].layers.length>0) {
//             const bottom = next[i].layers[0];
//             const bottomPct = Number(bottom.percent)||0;
//             const drainAmt = Math.min(bottomPct, toDrain);
//             if (drainAmt>0) {
//               next[i].layers[0] = { ...bottom, percent: Math.max(0, Number((bottomPct - drainAmt).toFixed(6))) };
//               changed = true;
//               toDrain -= drainAmt;
//             } else {
//               next[i].layers.shift();
//               changed = true;
//             }
//             if (next[i].layers[0] && Number(next[i].layers[0].percent) <= 0) {
//               next[i].layers.shift();
//             }
//           }
//         }
//         return changed ? next : prev;
//       });
//     }, 1000);
//     return () => { if (drainIntervalRef.current) { clearInterval(drainIntervalRef.current); drainIntervalRef.current=null; } };
//   }, []); // run once

//   // ---------- Submit logic (now includes clientSavedAt + clientTz) ----------
//   async function handleSubmit(){
//     const payload = {
//       rows: [], // add rows if available in UI
//       flows: (flows || Array(NUM).fill('')).map(v => Number(v) || 0),
//       generation: Number(generation) || 0,
//       bunkerCapacity: Number(bunkerCapacity) || 0,
//       bunkerCapacities: Array(NUM).fill(0),
//       clientBunkers,
//       coalColorMap: (typeof window !== 'undefined' && window.COAL_COLOR_MAP) ? window.COAL_COLOR_MAP : {},
//       clientSavedAt: new Date().toISOString(),
//       clientTz: (typeof Intl !== 'undefined' && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions) ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
//     };

//     setIsSubmitting(true);
//     try {
//       const res = await api.submitUnit(unit, payload);
//       let newId = null;
//       if (res) {
//         newId = res.id || res.blendId || (res.created && (res.created.id || res.created._id)) || (res.mapped && res.mapped.blendId) || null;
//       }

//       // store numeric snapshot in cache
//       const snapshotForCache = {
//         flows: payload.flows,
//         generation: payload.generation,
//         bunkerCapacity: payload.bunkerCapacity,
//         clientBunkers
//       };

//       setUnitsCache(prev => ({ ...prev, [unit]: snapshotForCache }));
//       setBlendId(newId || blendId);
//       pushToast(`Unit ${unit} submitted`, 'success');

//       // background refresh (will be ignored if user is editing because of applySnapshotToUI guard)
//       (async () => {
//         try {
//           const fresh = await api.getUnit(unit).catch(()=>null);
//           if (fresh) {
//             const snap = fresh.doc && fresh.doc.snapshot ? fresh.doc.snapshot : (fresh.blend ? fresh.blend : null);
//             if (snap) {
//               setUnitsCache(prev => ({ ...prev, [unit]: snap }));
//               if (!editingRef.current) {
//                 if (unit === Number(unit)) applySnapshotToUI(snap);
//               }
//               if (snap._id) setBlendId(String(snap._id));
//             }
//           }
//         } catch (err) {
//           console.warn('post-submit background refresh failed', err);
//         }
//       })();

//     } catch (err) {
//       console.error('submit error', err);
//       pushToast('Submit failed — see console', 'error');
//     } finally {
//       setIsSubmitting(false);
//     }
//   }

//   // ---------- UI ----------
//   const BLINK_THRESHOLD = 3 * 3600; // 3 hours in seconds

//   return (
//     <div>
//       <div className="navbar">
//         <h1>Coal Blend Dashboard</h1>
//       </div>

//       <Sidebar unit={unit} setUnit={(u) => setUnit(u)} />

//       <div className="input-section" style={{ marginTop: 'calc(var(--navbar-height) + 8px)' }}>
//         <div>
//           <label>Bunker capacity</label><br />
//           <input
//             className="input-box"
//             type="number"
//             value={bunkerCapacity || ''}
//             onFocus={() => (editingRef.current = true)}
//             onBlur={() => (editingRef.current = false)}
//             onChange={(e)=> setBunkerCapacity(e.target.value)}
//           />
//         </div>
//         <div>
//           <label>Generation</label><br />
//           <input
//             className="input-box"
//             type="number"
//             value={generation || ''}
//             onFocus={() => (editingRef.current = true)}
//             onBlur={() => (editingRef.current = false)}
//             onChange={(e)=> setGeneration(e.target.value)}
//           />
//         </div>

//         <div style={{ display: 'flex', alignItems: 'end', marginLeft: 8 }}>
//           <button id="submitBtn" onClick={handleSubmit} disabled={isSubmitting || isLoadingUnit} style={{ background:'#ef4444', color:'#fff', padding:'8px 12px', borderRadius:8, border:'none', cursor:'pointer' }}>
//             { isSubmitting ? 'Submitting...' : `Submit (Unit ${unit})` }
//           </button>
//         </div>
//       </div>

//       <main className="main-container" style={{ marginTop: 16 }}>
//         <div className="diagram-and-mills" style={{ width: '100%' }}>
//           <div className="bunker-wrapper">
//             <BunkerDiagram
//               clientBunkers={clientBunkers}
//               addBunkerLayer={addBunkerLayer}
//               removeTopLayer={removeTopLayer}
//               bunkerCapacity={Number(bunkerCapacity || 0)}
//             />
//           </div>

//           <div className="spacer" />

//           <div className="row-label">Coal Flow</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'flow-'+i} className="row-box" style={{ gridColumn: `${i+2}` }}>
//               <input
//                 className="flow-input"
//                 value={flows[i] || ''}
//                 onFocus={() => (editingRef.current = true)}
//                 onBlur={() => (editingRef.current = false)}
//                 onChange={(e) => updateFlow(i, e.target.value)}
//                 placeholder="TPH"
//               />
//             </div>
//           ))}

//           <div className="row-label row-next-timer">Next Timer</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'timer-'+i} className="row-box row-next-timer" style={{ gridColumn: `${i+2}` }}>
//               <input
//                 className={`timer-input ${timersSeconds[i] && timersSeconds[i] > 0 && timersSeconds[i] <= BLINK_THRESHOLD ? 'timer-warning' : ''}`}
//                 readOnly
//                 value={timersSeconds[i] ? secondsToHHMMSS(timersSeconds[i]) : '--'}
//               />
//             </div>
//           ))}

//           <div className="row-label row-total-percent">Total %</div>
//           {Array.from({ length: NUM }).map((_, i) => (
//             <div key={'total-'+i} className="row-box row-total-percent" style={{ gridColumn: `${i+2}` }}>
//               <input className="total-input" readOnly value={(Number(totals[i]||0)).toFixed(2) + '%'} />
//             </div>
//           ))}

//         </div>
//       </main>

//       <Toasts toasts={toasts} removeToast={(id)=> setToasts(prev => prev.filter(t => t.id !== id))} />
//     </div>
//   );
// }


// src/App.jsx
// src/App.jsx (patched to avoid repeated snapshot re-applications)
import React, { useEffect, useMemo, useState, useRef } from 'react';
import Sidebar from './components/Sidebar';
import BunkerDiagram from './components/BunkerDiagram';
import Toasts from './components/Toast';
import api from './api/apiClient';

function secondsToHHMMSS(secondsRaw) {
  if (!isFinite(secondsRaw) || secondsRaw === null) return '--';
  const s = Math.max(0, Math.round(secondsRaw));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

export default function App() {
  const NUM = 8;

  const [unit, setUnit] = useState(1);
  const [bunkerCapacity, setBunkerCapacity] = useState(String(1000)); // keep as string for stable editing
  const [generation, setGeneration] = useState(String(0));
  const [flows, setFlows] = useState(Array(NUM).fill(''));
  const [clientBunkers, setClientBunkers] = useState(Array.from({ length: NUM }).map(()=>({ layers: [] })));

  const [blendId, setBlendId] = useState(null);
  const [isLoadingUnit, setIsLoadingUnit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);
  function pushToast(message, type='success', ttl=3500){
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(()=> setToasts(t => t.filter(x=>x.id !== id)), ttl);
  }

  // units cache state + ref to avoid effect loops
  const [unitsCache, setUnitsCache] = useState({1:null,2:null,3:null});
  const unitsCacheRef = useRef({1:null,2:null,3:null});
  function updateUnitsCache(updater){
    setUnitsCache(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      unitsCacheRef.current = next;
      return next;
    });
  }

  useEffect(() => { api.getCoals().catch(()=>[]); }, []);

  // Focus + edit stamps to avoid server clobbering
  const focusedFieldRef = useRef({ type: null, index: null });
  const lastEditedRef = useRef({});
  function stampEdited(key) { lastEditedRef.current[key] = Date.now(); console.debug && console.debug(`DEBUG: stampEdited ${key} @ ${lastEditedRef.current[key]}`); }

  // last server snapshot timestamp ref
  const lastServerSnapshotAtRef = useRef(0);
  function setLastServerSnapshotNow(){ lastServerSnapshotAtRef.current = Date.now(); console.debug && console.debug('DEBUG: lastServerSnapshotAt set to', lastServerSnapshotAtRef.current); }

  // Prefetch all units once on mount
  useEffect(() => {
    let cancelled = false;
    async function prefetchAll(){
      try {
        console.debug && console.debug('DEBUG: prefetchAll start');
        const promises = [1,2,3].map(u => api.getUnit(u).catch(() => null));
        const results = await Promise.all(promises);
        if (cancelled) return;
        const next = {1:null,2:null,3:null};
        results.forEach((r, idx) => {
          next[idx+1] = r && r.doc && r.doc.snapshot ? r.doc.snapshot : (r && r.blend ? r.blend : null);
        });
        // update both state and ref via helper
        updateUnitsCache(next);
        console.debug && console.debug('DEBUG: prefetchAll results stored to cache');
        // apply snapshot for current unit only if present
        const snapshot = next[unit];
        if (snapshot) {
          setLastServerSnapshotNow();
          applySnapshotToUI(snapshot, { source: 'prefetchAll' });
        }
      } catch (e) {
        console.error('prefetchAll error', e);
      }
    }
    prefetchAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // On unit change: apply cached snapshot immediately if present, then refresh
  useEffect(() => {
    let cancelled = false;
    async function loadAndMaybeRefresh(u){
      console.debug && console.debug('DEBUG: loadAndMaybeRefresh start for unit', u);
      setIsLoadingUnit(true);
      const cached = unitsCacheRef.current[u];
      if (cached) {
        console.debug && console.debug('DEBUG: applying cached snapshot for unit', u);
        applySnapshotToUI(cached, { source: 'cache' });
        setIsLoadingUnit(false);
      } else {
        setIsLoadingUnit(true);
      }

      try {
        const fresh = await api.getUnit(u).catch(()=>null);
        if (cancelled) return;
        const snapshot = fresh && fresh.doc && fresh.doc.snapshot ? fresh.doc.snapshot : (fresh && fresh.blend ? fresh.blend : null);
        if (snapshot) {
          console.debug && console.debug('DEBUG: fetched fresh snapshot for unit', u, snapshot && (snapshot._id || snapshot.blendId || '(no id)'));
          setLastServerSnapshotNow();
          // update cache (state + ref) but **do not** rely on cache state as effect dependency
          updateUnitsCache(prev => ({ ...prev, [u]: snapshot }));
          // only apply if different from user edits based on stamp logic inside applySnapshotToUI
          applySnapshotToUI(snapshot, { source: 'freshFetch' });
        }
      } catch (err) {
        console.warn('background refresh failed for unit', u, err);
      } finally {
        if (!cached) setIsLoadingUnit(false);
      }
    }

    loadAndMaybeRefresh(unit);
    return () => { cancelled = true; };
    // we intentionally do NOT include unitsCache in deps to avoid loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  // applySnapshotToUI: merge carefully, do not override focused or recently edited fields
  function applySnapshotToUI(snapshot, { source='unknown' } = {}) {
    if (!snapshot) return;
    console.groupCollapsed && console.groupCollapsed(`DEBUG: applySnapshotToUI called (source=${source})`);
    console.debug && console.debug('snapshot:', snapshot);
    const focused = focusedFieldRef.current || { type: null, index: null };
    const lastServerAt = lastServerSnapshotAtRef.current || 0;
    console.debug && console.debug('focusedFieldRef', focused, 'lastServerAt', lastServerAt);

    const flowsArr = Array.isArray(snapshot.flows) ? snapshot.flows : (snapshot.flows || Array(NUM).fill(0));
    const bc = Number(snapshot.bunkerCapacity || snapshot.bunker_capacity || 0);
    const gen = Number(snapshot.generation || 0);

    let cbunks = Array.from({ length: NUM }).map(()=>({ layers: [] }));
    if (Array.isArray(snapshot.clientBunkers) && snapshot.clientBunkers.length) {
      cbunks = Array.from({ length: NUM }).map((_, i) => {
        const b = snapshot.clientBunkers[i] || { layers: [] };
        return { layers: (b.layers || []).map(l => ({ ...l })) };
      });
    } else if (Array.isArray(snapshot.bunkers) && snapshot.bunkers.length) {
      cbunks = Array.from({ length: NUM }).map((_, i) => {
        const b = snapshot.bunkers[i] || { layers: [] };
        return { layers: (b.layers || []).map(l => ({ ...l })) };
      });
    }

    // Merge flows: only apply incoming if user hasn't edited since lastServerAt and field not focused
    setFlows(prevFlows => {
      const next = Array.isArray(prevFlows) ? [...prevFlows] : Array(NUM).fill('');
      let changed = false;
      for (let i = 0; i < NUM; i++) {
        const key = `flow:${i}`;
        const lastEdited = lastEditedRef.current[key] || 0;
        const isFocused = (focused.type === 'flow' && Number(focused.index) === i);
        const incoming = flowsArr[i];
        const incomingStr = (incoming === '' ? '' : String(Number(incoming || 0)));
        let action = 'noop';
        if (isFocused) {
          action = 'skip-focused';
        } else if (lastEdited > lastServerAt) {
          action = 'skip-userEditedNewer';
        } else {
          if (next[i] !== incomingStr) {
            next[i] = incomingStr;
            changed = true;
            action = 'applied';
          } else action = 'same';
        }
        console.debug && console.debug(`DEBUG: applySnapshotToUI merge decision for ${key} lastEdited=${lastEdited} incoming=${incomingStr} action=${action}`);
      }
      if (changed) console.debug && console.debug('DEBUG: flows will be updated to', next);
      return changed ? next : prevFlows;
    });

    // bunkerCapacity
    (function applyBc(){
      const key = 'bunkerCapacity';
      const lastEdited = lastEditedRef.current[key] || 0;
      const isFocused = focused.type === 'bunkerCapacity';
      const incomingStr = String(Number(bc || 0));
      let action = 'noop';
      if (isFocused) action = 'skip-focused';
      else if (lastEdited > lastServerAt) action = 'skip-userEditedNewer';
      else { action = 'applied'; setBunkerCapacity(incomingStr); }
      console.debug && console.debug(`DEBUG: applySnapshotToUI merge decision for ${key} lastEdited=${lastEdited} incoming=${incomingStr} action=${action}`);
    })();

    // generation
    (function applyGen(){
      const key = 'generation';
      const lastEdited = lastEditedRef.current[key] || 0;
      const isFocused = focused.type === 'generation';
      const incomingStr = String(Number(gen || 0));
      let action = 'noop';
      if (isFocused) action = 'skip-focused';
      else if (lastEdited > lastServerAt) action = 'skip-userEditedNewer';
      else { action = 'applied'; setGeneration(incomingStr); }
      console.debug && console.debug(`DEBUG: applySnapshotToUI merge decision for ${key} lastEdited=${lastEdited} incoming=${incomingStr} action=${action}`);
    })();

    // clientBunkers: apply visual layers from snapshot (safe to overwrite)
    console.debug && console.debug('DEBUG: clientBunkers from snapshot will be applied (visual layers). length:', cbunks.length);
    setClientBunkers(cbunks);

    if (snapshot && snapshot._id) setBlendId(String(snapshot._id));
    else if (snapshot && snapshot.blendId) setBlendId(String(snapshot.blendId));
    console.groupEnd && console.groupEnd();
  }

  // core helpers
  function updateFlow(i, v) {
    console.debug && console.debug('DEBUG: onChange flow', i, 'value', v);
    setFlows(prev => {
      const next = Array.isArray(prev) ? [...prev] : Array(NUM).fill('');
      next[i] = (v === '' ? '' : String(v));
      return next;
    });
    stampEdited(`flow:${i}`);
  }
  function addBunkerLayer(bunkerIndex, layer) {
    console.debug && console.debug('DEBUG: addBunkerLayer', bunkerIndex, layer);
    setClientBunkers(prev => {
      const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
      next[bunkerIndex].layers.push(layer);
      return next;
    });
    stampEdited('clientBunkers');
  }
  function removeTopLayer(bunkerIndex) {
    console.debug && console.debug('DEBUG: removeTopLayer', bunkerIndex);
    setClientBunkers(prev => {
      const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
      if (next[bunkerIndex].layers.length > 0) next[bunkerIndex].layers.pop();
      return next;
    });
    stampEdited('clientBunkers');
  }

  const totals = useMemo(() => {
    return clientBunkers.map(b => (b.layers||[]).reduce((s,L)=> s + (Number(L.percent)||0),0));
  }, [clientBunkers]);

  const timersSeconds = useMemo(() => {
    return totals.map((totalPct, idx) => {
      const flow = Number(flows[idx] || 0);
      const bc = Number(bunkerCapacity || 0);
      if (totalPct <= 0 || bc <= 0 || flow <= 0) return null;
      const hours = (totalPct / 100) * bc / flow;
      return Math.max(0, hours * 3600);
    });
  }, [totals, flows, bunkerCapacity]);

  // bottom-first drain interval (single interval)
  const drainIntervalRef = useRef(null);
  const flowsRef = useRef(flows); useEffect(()=>{ flowsRef.current = flows; }, [flows]);
  const bunkerCapacityRef = useRef(bunkerCapacity); useEffect(()=>{ bunkerCapacityRef.current = bunkerCapacity; }, [bunkerCapacity]);

  useEffect(() => {
    if (drainIntervalRef.current) {
      clearInterval(drainIntervalRef.current);
      drainIntervalRef.current = null;
    }
    drainIntervalRef.current = setInterval(() => {
      // debug tick
      console.debug && console.debug('DEBUG: drainTick');
      setClientBunkers(prev => {
        const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
        let changed = false;
        for (let i=0;i<NUM;i++){
          const flow=Number(flowsRef.current[i]||0);
          const bc=Number(bunkerCapacityRef.current||0);
          if (flow<=0||bc<=0) continue;
          const totalPct = (next[i].layers||[]).reduce((s,L)=>s+(Number(L.percent)||0),0);
          if (totalPct<=0) continue;
          const percentPerSec = (flow/3600)/bc*100;
          if (percentPerSec<=0) continue;
          let toDrain = percentPerSec;
          while (toDrain>0 && next[i].layers.length>0) {
            const bottom = next[i].layers[0];
            const bottomPct = Number(bottom.percent)||0;
            const drainAmt = Math.min(bottomPct, toDrain);
            if (drainAmt>0) {
              next[i].layers[0] = { ...bottom, percent: Math.max(0, Number((bottomPct - drainAmt).toFixed(6))) };
              changed = true;
              toDrain -= drainAmt;
            } else {
              next[i].layers.shift();
              changed = true;
            }
            if (next[i].layers[0] && Number(next[i].layers[0].percent) <= 0) {
              next[i].layers.shift();
            }
          }
        }
        if (changed) console.debug && console.debug('DEBUG: drainTick changed clientBunkers');
        return changed ? next : prev;
      });
    }, 1000);
    return () => { if (drainIntervalRef.current) { clearInterval(drainIntervalRef.current); drainIntervalRef.current=null; } };
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Submit logic ----------
  async function handleSubmit(){
    console.debug && console.debug('DEBUG: handleSubmit start');
    focusedFieldRef.current = { type: null, index: null };

    const numericFlows = (flows || Array(NUM).fill('')).map(v => Number(v) || 0);
    const payload = {
      rows: [],
      flows: numericFlows,
      generation: Number(generation) || 0,
      bunkerCapacity: Number(bunkerCapacity) || 0,
      bunkerCapacities: Array(NUM).fill(0),
      clientBunkers,
      coalColorMap: (typeof window !== 'undefined' && window.COAL_COLOR_MAP) ? window.COAL_COLOR_MAP : {},
      clientSavedAt: new Date().toISOString(),
      clientTz: (typeof Intl !== 'undefined' && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions) ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
    };

    setIsSubmitting(true);
    try {
      console.debug && console.debug('DEBUG: submit payload', payload);
      const res = await api.submitUnit(unit, payload);
      console.debug && console.debug('DEBUG: submit response', res);
      let newId = null;
      if (res) {
        newId = res.id || res.blendId || (res.created && (res.created.id || res.created._id)) || (res.mapped && res.mapped.blendId) || null;
      }

      const snapshotForCache = {
        flows: payload.flows,
        generation: payload.generation,
        bunkerCapacity: payload.bunkerCapacity,
        clientBunkers
      };
      updateUnitsCache(prev => ({ ...prev, [unit]: snapshotForCache }));
      setBlendId(newId || blendId);
      pushToast(`Unit ${unit} submitted`, 'success');

      setLastServerSnapshotNow();

      (async () => {
        try {
          console.debug && console.debug('DEBUG: post-submit background refresh start');
          const fresh = await api.getUnit(unit).catch(()=>null);
          if (fresh) {
            const snap = fresh.doc && fresh.doc.snapshot ? fresh.doc.snapshot : (fresh.blend ? fresh.blend : null);
            if (snap) {
              console.debug && console.debug('DEBUG: post-submit background refresh got snap', snap && (snap._id || snap.blendId));
              setLastServerSnapshotNow();
              updateUnitsCache(prev => ({ ...prev, [unit]: snap }));
              applySnapshotToUI(snap, { source: 'postSubmitRefresh' });
              if (snap._id) setBlendId(String(snap._id));
            }
          }
        } catch (err) {
          console.warn('post-submit background refresh failed', err);
        }
      })();

    } catch (err) {
      console.error('submit error', err);
      pushToast('Submit failed — see console', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---------- UI ----------
  const BLINK_THRESHOLD = 3 * 3600; // 3 hours in seconds

  return (
    <div>
      <div className="navbar">
        <h1>Coal Blend Dashboard</h1>
      </div>

      <Sidebar unit={unit} setUnit={(u) => setUnit(u)} />

      <div className="input-section" style={{ marginTop: 'calc(var(--navbar-height) + 8px)' }}>
        <div>
          <label>Bunker capacity</label><br />
          <input
            className="input-box"
            type="number"
            value={bunkerCapacity || ''}
            onFocus={() => { focusedFieldRef.current = { type: 'bunkerCapacity', index: null }; console.debug && console.debug('DEBUG: focus bunkerCapacity'); }}
            onBlur={() => { focusedFieldRef.current = { type: null, index: null }; console.debug && console.debug('DEBUG: blur bunkerCapacity'); }}
            onChange={(e)=> { setBunkerCapacity(e.target.value); stampEdited('bunkerCapacity'); }}
          />
        </div>
        <div>
          <label>Generation</label><br />
          <input
            className="input-box"
            type="number"
            value={generation || ''}
            onFocus={() => { focusedFieldRef.current = { type: 'generation', index: null }; console.debug && console.debug('DEBUG: focus generation'); }}
            onBlur={() => { focusedFieldRef.current = { type: null, index: null }; console.debug && console.debug('DEBUG: blur generation'); }}
            onChange={(e)=> { setGeneration(e.target.value); stampEdited('generation'); }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'end', marginLeft: 8 }}>
          <button id="submitBtn" onClick={handleSubmit} disabled={isSubmitting || isLoadingUnit} style={{ background:'#ef4444', color:'#fff', padding:'8px 12px', borderRadius:8, border:'none', cursor:'pointer' }}>
            { isSubmitting ? 'Submitting...' : `Submit (Unit ${unit})` }
          </button>
        </div>
      </div>

      <main className="main-container" style={{ marginTop: 16 }}>
        <div className="diagram-and-mills" style={{ width: '100%' }}>
          <div className="bunker-wrapper">
            <BunkerDiagram
              clientBunkers={clientBunkers}
              addBunkerLayer={addBunkerLayer}
              removeTopLayer={removeTopLayer}
              bunkerCapacity={Number(bunkerCapacity || 0)}
              onUserEdit={(key) => { stampEdited(key); console.debug && console.debug('DEBUG: BunkerDiagram reported userEdit', key); }}
            />
          </div>

          <div className="spacer" />

          <div className="row-label">Coal Flow</div>
          {Array.from({ length: NUM }).map((_, i) => (
            <div key={'flow-'+i} className="row-box" style={{ gridColumn: `${i+2}` }}>
              <input
                className="flow-input"
                value={flows[i] || ''}
                onFocus={() => { focusedFieldRef.current = { type: 'flow', index: i }; console.debug && console.debug('DEBUG: focus flow', i); }}
                onBlur={() => { focusedFieldRef.current = { type: null, index: null }; console.debug && console.debug('DEBUG: blur flow', i); }}
                onChange={(e) => updateFlow(i, e.target.value)}
                placeholder="TPH"
              />
            </div>
          ))}

          <div className="row-label row-next-timer">Next Timer</div>
          {Array.from({ length: NUM }).map((_, i) => (
            <div key={'timer-'+i} className="row-box row-next-timer" style={{ gridColumn: `${i+2}` }}>
              <input
                className={`timer-input ${timersSeconds[i] && timersSeconds[i] > 0 && timersSeconds[i] <= BLINK_THRESHOLD ? 'timer-warning' : ''}`}
                readOnly
                value={timersSeconds[i] ? secondsToHHMMSS(timersSeconds[i]) : '--'}
              />
            </div>
          ))}

          <div className="row-label row-total-percent">Total %</div>
          {Array.from({ length: NUM }).map((_, i) => (
            <div key={'total-'+i} className="row-box row-total-percent" style={{ gridColumn: `${i+2}` }}>
              <input className="total-input" readOnly value={(Number(totals[i]||0)).toFixed(2) + '%'} />
            </div>
          ))}

        </div>
      </main>

      <Toasts toasts={toasts} removeToast={(id)=> setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}
