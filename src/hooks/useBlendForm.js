// src/hooks/useBlendForm.js
import { useState, useCallback } from 'react';
import api from '../api/apiClient';

export const NUM_BUNKERS = 8;
export const NUM_ROWS = 3;

const makeDefaultRows = (n = NUM_ROWS) => Array.from({ length: n }).map(() => ({
  coal: '',
  percentages: Array(NUM_BUNKERS).fill(0),
  gcv: 0,
  cost: 0
}));

export default function useBlendForm(initial = {}) {
  const [rows, setRows] = useState(initial.rows || makeDefaultRows());
  const [flows, setFlows] = useState(initial.flows || Array(NUM_BUNKERS).fill(0));
  const [generation, setGeneration] = useState(initial.generation || 0);
  const [bunkerCapacity, setBunkerCapacity] = useState(initial.bunkerCapacity || 0);
  const [bunkerCapacities, setBunkerCapacities] = useState(initial.bunkerCapacities || Array(NUM_BUNKERS).fill(0));
  const [clientBunkers, setClientBunkers] = useState(initial.clientBunkers || Array(NUM_BUNKERS).fill(null).map(()=>({ layers: [] })));

  // ensure COAL_DB pop when api.getCoals was loaded
  async function ensureCoalsLoaded() {
    const c = await api.getCoals().catch(()=>[]);
    // api.getCoals sets window.COAL_DB already
    return c;
  }

  // Legacy helper: find coal in DB by id or name
  function findCoalInDB(idOrName) {
    if(!idOrName) return null;
    const db = (typeof window !== 'undefined' && window.COAL_DB) ? window.COAL_DB : [];
    for(let i=0;i<db.length;i++){
      if(String(db[i]._id) === String(idOrName) || String(db[i].id) === String(idOrName)) return db[i];
    }
    for(let j=0;j<db.length;j++){
      if(String((db[j].coal || '')).toLowerCase() === String(idOrName).toLowerCase()) return db[j];
    }
    return null;
  }

  // cell-level helpers (mimic old behavior)
  function getCellCoalId(row, mill) {
    // in React we model per-row global selection and per-cell overrides via DOM inputs if needed;
    // here we check if hidden per-cell exists in clientBunkers (not strictly required).
    // For full parity, prefer row.coal else empty string
    const r = rows[row];
    if(!r) return '';
    if(r.coal && typeof r.coal === 'string') return r.coal;
    return '';
  }
  function getCellGcv(row, mill) {
    // prefer cell-level stored value (not present) else row.gcv else DB
    const r = rows[row];
    const g = r ? (Number(r.gcv) || 0) : 0;
    if(g) return g;
    const id = getCellCoalId(row, mill);
    const co = findCoalInDB(id);
    return co ? (Number(co.gcv) || 0) : 0;
  }
  function getCellCost(row, mill) {
    const r = rows[row];
    const c = r ? (Number(r.cost) || 0) : 0;
    if(c) return c;
    const id = getCellCoalId(row, mill);
    const co = findCoalInDB(id);
    return co ? (Number(co.cost) || 0) : 0;
  }

  // row setters
  function setRowCoal(rowIndex, coalId) {
    setRows(prev => {
      const next = prev.map(r => ({ ...r, percentages: Array.isArray(r.percentages) ? [...r.percentages] : Array(NUM_BUNKERS).fill(0) }));
      next[rowIndex] = { ...next[rowIndex], coal: coalId };
      return next;
    });
  }
  function setRowPercent(rowIndex, millIndex, value) {
    setRows(prev => {
      const next = prev.map(r => ({ ...r, percentages: Array.isArray(r.percentages) ? [...r.percentages] : Array(NUM_BUNKERS).fill(0) }));
      next[rowIndex].percentages[millIndex] = Number(value) || 0;
      return next;
    });
  }
  function setRowGcv(rowIndex, value) {
    setRows(prev => {
      const next = prev.slice();
      next[rowIndex] = { ...next[rowIndex], gcv: Number(value) || 0 };
      return next;
    });
  }
  function setRowCost(rowIndex, value) {
    setRows(prev => {
      const next = prev.slice();
      next[rowIndex] = { ...next[rowIndex], cost: Number(value) || 0 };
      return next;
    });
  }

  // clientBunker management (add/remove)
  function addBunkerLayer(bunkerIndex, layerObj) {
    setClientBunkers(prev => {
      const next = prev.map(p => ({ layers: (p && Array.isArray(p.layers)) ? [...p.layers] : [] }));
      next[bunkerIndex].layers.push(layerObj);
      return next;
    });
  }
  function removeBunkerLayer(bunkerIndex, layerIndex) {
    setClientBunkers(prev => {
      const next = prev.map(p => ({ layers: (p && Array.isArray(p.layers)) ? [...p.layers] : [] }));
      if(next[bunkerIndex] && next[bunkerIndex].layers[layerIndex] !== undefined) next[bunkerIndex].layers.splice(layerIndex, 1);
      return next;
    });
  }

  // build payload identical to original collectFormData() shape
  const buildPayload = useCallback(() => {
    const rowsPayload = rows.map(r => ({
      coal: r.coal || '',
      percentages: (r.percentages || Array(NUM_BUNKERS).fill(0)).map(v => Number(v) || 0),
      gcv: Number(r.gcv) || 0,
      cost: Number(r.cost) || 0
    }));
    const flowsPayload = (flows || Array(NUM_BUNKERS).fill(0)).map(v => Number(v) || 0);
    const bunkerCaps = (bunkerCapacities && Array.isArray(bunkerCapacities) && bunkerCapacities.length === NUM_BUNKERS)
      ? bunkerCapacities.map(v => Number(v) || 0)
      : Array(NUM_BUNKERS).fill(0);
    const clientBunkersPayload = (clientBunkers || []).map(b => ({
      layers: (b.layers || []).map(l => ({
        rowIndex: l.rowIndex || undefined,
        coal: l.coal || '',
        percent: Number(l.percent) || 0,
        gcv: (l.gcv === undefined) ? undefined : Number(l.gcv),
        cost: (l.cost === undefined) ? undefined : Number(l.cost),
        color: l.color || undefined,
        timer: l.timer || undefined,
        rawSeconds: (l.rawSeconds === undefined) ? undefined : Number(l.rawSeconds)
      }))
    }));
    return {
      rows: rowsPayload,
      flows: flowsPayload,
      generation: Number(generation) || 0,
      bunkerCapacity: Number(bunkerCapacity) || 0,
      bunkerCapacities: bunkerCaps,
      clientBunkers: clientBunkersPayload
    };
  }, [rows, flows, generation, bunkerCapacity, bunkerCapacities, clientBunkers]);

  return {
    rows, flows, generation, bunkerCapacity, bunkerCapacities, clientBunkers,
    ensureCoalsLoaded, findCoalInDB,
    setFlows, setGeneration, setBunkerCapacity, setBunkerCapacities,
    setRowCoal, setRowPercent, setRowGcv, setRowCost,
    addBunkerLayer, removeBunkerLayer,
    buildPayload
  };
}
