// src/App.jsx
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
  const [bunkerCapacity, setBunkerCapacity] = useState(String(1000));
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

  const focusedFieldRef = useRef({ type: null, index: null });
  const lastEditedRef = useRef({});
  function stampEdited(key) { lastEditedRef.current[key] = Date.now(); }

  const lastServerSnapshotAtRef = useRef(0);
  function setLastServerSnapshotNow(){ lastServerSnapshotAtRef.current = Date.now(); }

  useEffect(() => {
    let cancelled = false;
    async function prefetchAll(){
      try {
        const promises = [1,2,3].map(u => api.getUnit(u).catch(() => null));
        const results = await Promise.all(promises);
        if (cancelled) return;
        const next = {1:null,2:null,3:null};
        results.forEach((r, idx) => {
          next[idx+1] = r && r.doc && r.doc.snapshot ? r.doc.snapshot : (r && r.blend ? r.blend : null);
        });
        updateUnitsCache(next);
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
  }, []); // run once

  useEffect(() => {
    let cancelled = false;
    async function loadAndMaybeRefresh(u){
      setIsLoadingUnit(true);
      const cached = unitsCacheRef.current[u];
      if (cached) {
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
          setLastServerSnapshotNow();
          updateUnitsCache(prev => ({ ...prev, [u]: snapshot }));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  function applySnapshotToUI(snapshot, { source='unknown' } = {}) {
    if (!snapshot) return;
    const focused = focusedFieldRef.current || { type: null, index: null };
    const lastServerAt = lastServerSnapshotAtRef.current || 0;

    const flowsArr = Array.isArray(snapshot.flows) ? snapshot.flows : (snapshot.flows || Array(NUM).fill(0));
    const bc = Number(snapshot.bunkerCapacity || snapshot.bunker_capacity || 0);
    const gen = Number(snapshot.generation || 0);

    let cbunks = Array.from({ length: NUM }).map(()=>({ layers: [] }));

    // Backfill from snapshot.clientBunkers or snapshot.bunkers and integrate snapshot.bunkerTimers if present
    const bunkerTimers = Array.isArray(snapshot.bunkerTimers) ? snapshot.bunkerTimers : [];

    if (Array.isArray(snapshot.clientBunkers) && snapshot.clientBunkers.length) {
      cbunks = Array.from({ length: NUM }).map((_, i) => {
        const b = snapshot.clientBunkers[i] || { layers: [] };
        const timerForB = bunkerTimers[i] || null;
        return {
          layers: (b.layers || []).map((l, li) => {
            const percentNum = Number(l.percent) || 0;
            const initialPercent = Number(l.initialPercent || percentNum) || percentNum;

            // Prefer persisted layerTimerSeconds, else try bunkerTimers entry
            let layerTimerSeconds = (l.layerTimerSeconds == null) ? null : Number(l.layerTimerSeconds);
            if (layerTimerSeconds == null && timerForB && Array.isArray(timerForB.layers) && timerForB.layers[li] && timerForB.layers[li].initialSeconds != null) {
              layerTimerSeconds = Math.max(0, Math.round(Number(timerForB.layers[li].initialSeconds)));
            } else if (layerTimerSeconds == null) {
              // fallback compute using snapshot flows & bc
              const flow = Number((snapshot.flows && snapshot.flows[i]) || flows[i] || 0);
              if (flow > 0 && bc > 0 && initialPercent > 0) {
                const hours = (initialPercent / 100) * bc / flow;
                layerTimerSeconds = Math.max(0, Math.round(hours * 3600));
              } else {
                layerTimerSeconds = null;
              }
            }

            return {
              ...l,
              percent: Number(percentNum).toFixed(6),
              initialPercent,
              layerTimerSeconds
            };
          })
        };
      });
    } else if (Array.isArray(snapshot.bunkers) && snapshot.bunkers.length) {
      cbunks = Array.from({ length: NUM }).map((_, i) => {
        const b = snapshot.bunkers[i] || { layers: [] };
        const timerForB = bunkerTimers[i] || null;
        return {
          layers: (b.layers || []).map((l, li) => {
            const percentNum = Number(l.percent) || 0;
            const initialPercent = Number(l.initialPercent || percentNum) || percentNum;
            let layerTimerSeconds = (l.layerTimerSeconds == null) ? null : Number(l.layerTimerSeconds);
            if (layerTimerSeconds == null && timerForB && Array.isArray(timerForB.layers) && timerForB.layers[li] && timerForB.layers[li].initialSeconds != null) {
              layerTimerSeconds = Math.max(0, Math.round(Number(timerForB.layers[li].initialSeconds)));
            } else if (layerTimerSeconds == null) {
              const flow = Number((snapshot.flows && snapshot.flows[i]) || flows[i] || 0);
              if (flow > 0 && bc > 0 && initialPercent > 0) {
                const hours = (initialPercent / 100) * bc / flow;
                layerTimerSeconds = Math.max(0, Math.round(hours * 3600));
              } else {
                layerTimerSeconds = null;
              }
            }
            return {
              ...l,
              percent: Number(percentNum).toFixed(6),
              initialPercent,
              layerTimerSeconds
            };
          })
        };
      });
    }

    // Merge flows
    setFlows(prevFlows => {
      const next = Array.isArray(prevFlows) ? [...prevFlows] : Array(NUM).fill('');
      let changed = false;
      for (let i = 0; i < NUM; i++) {
        const key = `flow:${i}`;
        const lastEdited = lastEditedRef.current[key] || 0;
        const isFocused = (focused.type === 'flow' && Number(focused.index) === i);
        const incoming = flowsArr[i];
        const incomingStr = (incoming === '' ? '' : String(Number(incoming || 0)));
        if (isFocused) {
          // skip
        } else if (lastEdited > lastServerAt) {
          // skip user newer
        } else {
          if (next[i] !== incomingStr) {
            next[i] = incomingStr;
            changed = true;
          }
        }
      }
      return changed ? next : prevFlows;
    });

    // bunkerCapacity
    (function applyBc(){
      const key = 'bunkerCapacity';
      const lastEdited = lastEditedRef.current[key] || 0;
      const isFocused = focused.type === 'bunkerCapacity';
      const incomingStr = String(Number(bc || 0));
      if (isFocused) return;
      if (lastEdited > lastServerAt) return;
      setBunkerCapacity(incomingStr);
    })();

    // generation
    (function applyGen(){
      const key = 'generation';
      const lastEdited = lastEditedRef.current[key] || 0;
      const isFocused = focused.type === 'generation';
      const incomingStr = String(Number(gen || 0));
      if (isFocused) return;
      if (lastEdited > lastServerAt) return;
      setGeneration(incomingStr);
    })();

    // apply clientBunkers visuals (safe to overwrite)
    setClientBunkers(cbunks);

    if (snapshot && snapshot._id) setBlendId(String(snapshot._id));
    else if (snapshot && snapshot.blendId) setBlendId(String(snapshot.blendId));
  }

  function updateFlow(i, v) {
    setFlows(prev => {
      const next = Array.isArray(prev) ? [...prev] : Array(NUM).fill('');
      next[i] = (v === '' ? '' : String(v));
      return next;
    });
    stampEdited(`flow:${i}`);
  }

  function addBunkerLayer(bunkerIndex, layer) {
    setClientBunkers(prev => {
      const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
      const percentNum = Number(layer.percent) || 0;
      const initialPercent = Number(layer.initialPercent || percentNum) || percentNum;

      const flow = Number(flows[bunkerIndex] || 0);
      const bc = Number(bunkerCapacity || 0);
      let layerTimerSeconds = null;
      if (flow > 0 && bc > 0 && initialPercent > 0) {
        const hours = (initialPercent / 100) * bc / flow;
        layerTimerSeconds = Math.max(0, Math.round(hours * 3600));
      }

      const layerToPush = {
        ...layer,
        percent: Number(percentNum).toFixed(6),
        initialPercent,
        layerTimerSeconds
      };

      next[bunkerIndex].layers.push(layerToPush);
      return next;
    });
    stampEdited('clientBunkers');
  }

  function removeTopLayer(bunkerIndex) {
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
      return Math.max(0, Math.round(hours * 3600));
    });
  }, [totals, flows, bunkerCapacity]);

  const perLayerTimers = useMemo(() => {
    return clientBunkers.map((b, idx) => {
      const flow = Number(flows[idx] || 0);
      const bc = Number(bunkerCapacity || 0);
      return (b.layers || []).map(l => {
        const pct = Number(l.percent) || 0;
        if (flow <= 0 || bc <= 0 || pct <= 0) return null;
        const hours = (pct / 100) * bc / flow;
        return Math.max(0, Math.round(hours * 3600));
      });
    });
  }, [clientBunkers, flows, bunkerCapacity]);

  const drainIntervalRef = useRef(null);
  const flowsRef = useRef(flows); useEffect(()=>{ flowsRef.current = flows; }, [flows]);
  const bunkerCapacityRef = useRef(bunkerCapacity); useEffect(()=>{ bunkerCapacityRef.current = bunkerCapacity; }, [bunkerCapacity]);

  useEffect(() => {
    if (drainIntervalRef.current) {
      clearInterval(drainIntervalRef.current);
      drainIntervalRef.current = null;
    }
    drainIntervalRef.current = setInterval(() => {
      setClientBunkers(prev => {
        const next = prev.map(x => ({ layers: [...(x.layers||[])] }));
        let changed = false;
        for (let i=0;i<NUM;i++){
          const flow = Number(flowsRef.current[i]||0);
          const bc = Number(bunkerCapacityRef.current||0);
          if (flow <= 0 || bc <= 0) continue;
          if (!next[i].layers || next[i].layers.length === 0) continue;

          const percentPerSec = (flow/3600)/bc*100;
          if (percentPerSec <= 0) continue;

          // strictly bottom-only drain per tick (no overflow to next layer in same tick)
          const bottom = next[i].layers[0];
          const bottomPct = Number(bottom.percent) || 0;
          if (bottomPct <= 0) {
            next[i].layers.shift();
            changed = true;
            continue;
          }

          const drainAmt = Math.min(bottomPct, percentPerSec);
          if (drainAmt > 0) {
            next[i].layers[0] = {
              ...bottom,
              percent: Number(Math.max(0, Number((bottomPct - drainAmt).toFixed(6))))
            };
            changed = true;
          }

          if (next[i].layers[0] && Number(next[i].layers[0].percent) <= 0) {
            next[i].layers.shift();
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => { if (drainIntervalRef.current) { clearInterval(drainIntervalRef.current); drainIntervalRef.current=null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(){
    focusedFieldRef.current = { type: null, index: null };

    const numericFlows = (flows || Array(NUM).fill('')).map(v => Number(v) || 0);

    // Prepare clientBunkers payload: ensure layer.initialPercent & layer.layerTimerSeconds are present
    const payloadClientBunkers = clientBunkers.map((b, bi) => {
      const flow = Number(numericFlows[bi] || 0);
      const bc = Number(bunkerCapacity || 0);
      const layers = (b.layers || []).map((l, li) => {
        const percentNum = Number(l.percent) || 0;
        const initialPercent = Number(l.initialPercent || percentNum) || percentNum;
        let layerTimerSeconds = (l.layerTimerSeconds == null) ? null : Number(l.layerTimerSeconds);
        if (layerTimerSeconds == null && flow > 0 && bc > 0 && initialPercent > 0) {
          const hours = (initialPercent / 100) * bc / flow;
          layerTimerSeconds = Math.max(0, Math.round(hours * 3600));
        }
        return {
          ...l,
          percent: Number(percentNum),
          initialPercent,
          layerTimerSeconds
        };
      });
      return { layers };
    });

    const payload = {
      rows: [], // keep as empty here unless you keep rows state elsewhere
      flows: numericFlows,
      generation: Number(generation) || 0,
      bunkerCapacity: Number(bunkerCapacity) || 0,
      bunkerCapacities: Array(NUM).fill(0),
      clientBunkers: payloadClientBunkers,
      coalColorMap: (typeof window !== 'undefined' && window.COAL_COLOR_MAP) ? window.COAL_COLOR_MAP : {},
      clientSavedAt: new Date().toISOString(),
      clientTz: (typeof Intl !== 'undefined' && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions) ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
    };

    setIsSubmitting(true);
    try {
      const res = await api.submitUnit(unit, payload);
      let newId = null;
      if (res) {
        newId = res.id || res.blendId || (res.created && (res.created.id || res.created._id)) || (res.mapped && res.mapped.blendId) || null;
      }

      const snapshotForCache = {
        flows: payload.flows,
        generation: payload.generation,
        bunkerCapacity: payload.bunkerCapacity,
        clientBunkers: payload.clientBunkers
      };
      updateUnitsCache(prev => ({ ...prev, [unit]: snapshotForCache }));
      setBlendId(newId || blendId);
      pushToast(`Unit ${unit} submitted`, 'success');

      setLastServerSnapshotNow();

      (async () => {
        try {
          const fresh = await api.getUnit(unit).catch(()=>null);
          if (fresh) {
            const snap = fresh.doc && fresh.doc.snapshot ? fresh.doc.snapshot : (fresh.blend ? fresh.blend : null);
            if (snap) {
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

  const BLINK_THRESHOLD = 3 * 3600; // 3 hours

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
            onFocus={() => { focusedFieldRef.current = { type: 'bunkerCapacity', index: null }; }}
            onBlur={() => { focusedFieldRef.current = { type: null, index: null }; }}
            onChange={(e)=> { setBunkerCapacity(e.target.value); stampEdited('bunkerCapacity'); }}
          />
        </div>
        <div>
          <label>Generation</label><br />
          <input
            className="input-box"
            type="number"
            value={generation || ''}
            onFocus={() => { focusedFieldRef.current = { type: 'generation', index: null }; }}
            onBlur={() => { focusedFieldRef.current = { type: null, index: null }; }}
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
              onUserEdit={(key) => { stampEdited(key); }}
            />
          </div>

          <div className="spacer" />

          <div className="row-label">Coal Flow</div>
          {Array.from({ length: NUM }).map((_, i) => (
            <div key={'flow-'+i} className="row-box" style={{ gridColumn: `${i+2}` }}>
              <input
                className="flow-input"
                value={flows[i] || ''}
                onFocus={() => { focusedFieldRef.current = { type: 'flow', index: i }; }}
                onBlur={() => { focusedFieldRef.current = { type: null, index: null }; }}
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
