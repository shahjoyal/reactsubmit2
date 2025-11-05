// // src/hooks/useBunkerManager.js
// import { useEffect, useRef } from 'react';

// /*
//   useBunkerManager
//   - rows: array of row objects (percentages etc)
//   - flows: array of 8 flows (TPH)
//   - bunkerCapacity: global capacity number
//   - clientBunkers + setClientBunkers: react state for per-bunker layers
//   - options:
//       numBunkers (default 8), numRows (default 3)
//   Behavior:
//   - compute layerSeconds (bottom->top) per bunker
//   - compute total percent per bunker
//   - compute seconds-to-empty using same formula: hours = (totalPct/100 * bunkerCap) / flow ; seconds = hours*3600
//   - set per-bunker interval to decrease percentages each second (decrementPercentagesBy)
//   - write timer strings `HH:MM:SS` and rawSeconds into layer objects in clientBunkers
// */
// export default function useBunkerManager({
//   rows, flows, bunkerCapacity,
//   clientBunkers, setClientBunkers,
//   numBunkers=8, numRows=3
// }) {
//   const timersRef = useRef(Array.from({length:numBunkers}).map(()=>({ intervalId: null, remaining: 0, lastKnownTotalSeconds: 0, running: false })));

//   // helper to format HH:MM:SS
//   function formatHMS(secRaw){
//     const s = Math.max(0, Math.round(secRaw || 0));
//     const h = Math.floor(s/3600);
//     const m = Math.floor((s%3600)/60);
//     const sec = s % 60;
//     return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
//   }

//   // compute total percent for bunker bIndex (sum of row percentages for that mill)
//   function getTotalPercentForBunker(bIndex){
//     if(!Array.isArray(rows)) return 0;
//     let s = 0;
//     for(let r=0;r<rows.length;r++){
//       s += Number((rows[r].percentages && rows[r].percentages[bIndex]) || 0);
//     }
//     return Number(s);
//   }

//   // compute per-layer seconds array (bottom->top) similar to computeLayerSeconds in original
//   function computeLayerSecondsForBunker(bIndex){
//     // original design: compute seconds for each layer proportional to its percent relative to total, using formula
//     const totalPct = getTotalPercentForBunker(bIndex);
//     const flow = Number((flows && flows[bIndex]) || 0);
//     const bunkerCap = Number(bunkerCapacity || 0);

//     const out = [];
//     if(totalPct <= 0 || bunkerCap <= 0 || flow <= 0) {
//       // if any param missing, output zeros per NUM_ROWS
//       for(let r=0;r<numRows;r++) out.push(0);
//       return out;
//     }
//     // total seconds for the bunker:
//     const hours = (totalPct / 100) * bunkerCap / flow;
//     const totalSeconds = Math.max(1, Math.floor(hours * 3600));
//     // distribute seconds proportionally by each row's percent
//     for(let r = numRows-1; r >= 0; r--){ // bottom->top in original indexing (row NUM -> row1)
//       const rowIndex = r;
//       const pct = Number(rows[rowIndex] && rows[rowIndex].percentages ? (rows[rowIndex].percentages[bIndex] || 0) : 0);
//       if(pct <= 0) out.push(0);
//       else {
//         const sec = Math.max(0, Math.floor(totalSeconds * (pct / Math.max(0.000001, totalPct))));
//         out.push(sec);
//       }
//     }
//     return out; // bottom->top array length = numRows
//   }

//   // update clientBunkers layer timers and rawSeconds based on computed layerSeconds
//   function updateClientBunkerLayerTimers(bIndex, layerSeconds, remainingForLayerIndex, remainingSecondsForLayer){
//     setClientBunkers(prev => {
//       const next = prev.map(p => ({ layers: Array.isArray(p.layers) ? [...p.layers] : [] }));
//       // ensure next[bIndex].layers exists with same length as layerSeconds
//       const layers = next[bIndex].layers || [];
//       // pad layers so we can write timer into matching bottom->top positions (layerSeconds align to rows)
//       // original mapping: layer index 0 corresponds to bottom (row numRows)
//       for(let li=0; li<layerSeconds.length; li++){
//         const mappedRow = (numRows - li); // 1..numRows
//         if(!layers[li]) layers[li] = { rowIndex: mappedRow, coal: layers[li] ? layers[li].coal : '', percent: layers[li] ? layers[li].percent : 0 };
//         const raw = layerSeconds[li];
//         // compute timer text: if this layer is current draining layer, use remainingSecondsForLayer else full raw
//         const useRaw = (li === remainingForLayerIndex) ? Math.max(0, Math.round(remainingSecondsForLayer || 0)) : Math.max(0, Math.round(raw || 0));
//         layers[li].rawSeconds = useRaw;
//         layers[li].timer = formatHMS(useRaw);
//       }
//       next[bIndex].layers = layers;
//       return next;
//     });
//   }

//   // decrement percentages by a small amount for bIndex: this must update the rows state (stored outside) -
//   // but we cannot mutate parent rows here; instead we compute new rows percent values and update clientBunkers' layer percents for visual only.
//   // To keep parity with original behaviour (which mutated DOM percentage inputs), we update clientBunkers layer percent values.
//   function decrementPercentagesBy(bIndex, lossThisSecond){
//     // lossThisSecond is in percent units (e.g., 0.5%/s) derived by original: lossThisSecond = currentTotal / remainingSec
//     setClientBunkers(prev => {
//       const next = prev.map(p => ({ layers: Array.isArray(p.layers) ? [...p.layers] : [] }));
//       const layers = next[bIndex].layers || [];
//       // distribute loss by topmost non-zero layer (original decremented bottom->top logic but used the currentLayer index)
//       // We'll apply reduction to the current draining layer (first layer from bottom that has remaining rawSeconds > 0)
//       // find current layer index
//       let currentIdx = -1;
//       for(let i=0;i<layers.length;i++){
//         if((layers[i].rawSeconds || 0) > 0) { currentIdx = i; break; }
//       }
//       if(currentIdx === -1) {
//         // fallback: reduce topmost layer
//         if(layers.length) currentIdx = layers.length - 1;
//       }
//       if(currentIdx >= 0 && layers[currentIdx]){
//         const oldPct = Number(layers[currentIdx].percent || 0);
//         const newPct = Math.max(0, oldPct - Number(lossThisSecond || 0));
//         layers[currentIdx].percent = newPct;
//       }
//       next[bIndex].layers = layers;
//       return next;
//     });
//   }

//   function clearBunkerTimer(bIndex, dueToExpiry=false){
//     const t = timersRef.current[bIndex];
//     if(!t) return;
//     if(t.intervalId) { clearInterval(t.intervalId); t.intervalId = null; t.running = false; }
//     t.remaining = 0;
//     t.lastKnownTotalSeconds = 0;
//   }

//   function setBunkerTimer(bIndex, fullSeconds, startTotalPct) {
//     const t = timersRef.current[bIndex];
//     const secs = Math.max(1, Math.floor(Number(fullSeconds) || 0));
//     if(t.intervalId && Math.abs((t.lastKnownTotalSeconds||0) - secs) <= 1){
//       t.startTotalPct = Number(startTotalPct) || t.startTotalPct || 0;
//       return;
//     }
//     if(t.intervalId) clearBunkerTimer(bIndex);
//     t.remaining = secs;
//     t.lastKnownTotalSeconds = secs;
//     t.startTotalPct = Number(startTotalPct) || 0;
//     t.running = true;

//     // compute per-layer seconds snapshot and write timers into clientBunkers
//     const layerSecs = computeLayerSecondsForBunker(bIndex);
//     // initial currentLayer is index of first layer from bottom with non-zero sec
//     let currentLayer = -1;
//     for(let li=0; li<layerSecs.length; li++){
//       if(layerSecs[li] > 0) { currentLayer = li; break; }
//     }
//     // track layerRemaining seconds (for current draining layer)
//     let layerRemaining = (currentLayer >= 0) ? layerSecs[currentLayer] : 0;

//     // write initial timers into clientBunkers
//     updateClientBunkerLayerTimers(bIndex, layerSecs, currentLayer, layerRemaining);

//     // interval tick
//     t.intervalId = setInterval(() => {
//       const remainingSec = Math.max(1, Math.floor(t.remaining || 1));
//       // current total percent (based on rows live values)
//       let currentTotal = getTotalPercentForBunker(bIndex);
//       const lossThisSecond = currentTotal / remainingSec;
//       if(lossThisSecond > 0){
//         // decrement displayed percentages in clientBunkers
//         decrementPercentagesBy(bIndex, lossThisSecond);
//       }

//       // decrement timers: if layerRemaining > 0 -> layerRemaining-- else move to next layer
//       if(layerRemaining <= 0) {
//         // advance currentLayer to next non-zero layer (higher index)
//         let nextLayer = -1;
//         for(let li=currentLayer+1; li<layerSecs.length; li++){
//           if(layerSecs[li] > 0) { nextLayer = li; break; }
//         }
//         currentLayer = nextLayer;
//         layerRemaining = (currentLayer >= 0) ? layerSecs[currentLayer] : 0;
//       } else {
//         layerRemaining = Math.max(0, Math.floor(layerRemaining - 1));
//       }

//       t.remaining = Math.max(0, Math.floor(t.remaining - 1));

//       // if running, update clientBunkers timers each tick with new layerRemaining/timers
//       updateClientBunkerLayerTimers(bIndex, layerSecs, currentLayer, layerRemaining);

//       if(t.remaining <= 0){
//         clearBunkerTimer(bIndex, true);
//       }
//     }, 1000);
//   }

//   // compute seconds-to-empty (same formula as original)
//   function computeSecondsToEmpty(bIndex){
//     const totalPct = getTotalPercentForBunker(bIndex);
//     const flow = Number((flows && flows[bIndex]) || 0);
//     const bunkerCap = Number(bunkerCapacity || 0);
//     if(totalPct <= 0 || bunkerCap <= 0 || flow <= 0) return 0;
//     const hours = (totalPct / 100) * bunkerCap / flow;
//     const seconds = Math.max(1, Math.floor(hours * 3600));
//     return seconds;
//   }

//   // computeAll: start timers for all bunkers
//   function computeAllAndStart(){
//     for(let i=0;i<numBunkers;i++){
//       const secs = computeSecondsToEmpty(i);
//       if(secs > 0) setBunkerTimer(i, secs, getTotalPercentForBunker(i));
//       else clearBunkerTimer(i);
//     }
//   }

//   useEffect(() => {
//     // whenever rows/flows/bunkerCapacity change, recompute timers appropriately.
//     computeAllAndStart();
//     return () => {
//       // cleanup on unmount
//       for(let i=0;i<numBunkers;i++){
//         const t = timersRef.current[i];
//         if(t && t.intervalId) clearInterval(t.intervalId);
//       }
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [rows, flows, bunkerCapacity]);

//   return {
//     computeAllAndStart,
//     computeSecondsToEmpty,
//     clearBunkerTimer,
//     setBunkerTimer
//   };
// }


// src/hooks/useBunkerManager.js
import { useEffect, useRef } from 'react';

export default function useBunkerManager({
  rows, flows, bunkerCapacity,
  clientBunkers, setClientBunkers,
  numBunkers=8, numRows=3
}) {
  const timersRef = useRef(Array.from({length:numBunkers}).map(()=>({ intervalId: null, remaining: 0, lastKnownTotalSeconds: 0, running: false })));

  function formatHMS(secRaw){
    const s = Math.max(0, Math.round(secRaw || 0));
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const sec = s % 60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
  }

  function getTotalPercentForBunker(bIndex){
    if(!Array.isArray(rows)) return 0;
    let s = 0;
    for(let r=0;r<rows.length;r++){
      s += Number((rows[r].percentages && rows[r].percentages[bIndex]) || 0);
    }
    return Number(s);
  }

  function computeLayerSecondsForBunker(bIndex){
    const totalPct = getTotalPercentForBunker(bIndex);
    const flow = Number((flows && flows[bIndex]) || 0);
    const bunkerCap = Number(bunkerCapacity || 0);

    const out = [];
    if(totalPct <= 0 || bunkerCap <= 0 || flow <= 0) {
      for(let r=0;r<numRows;r++) out.push(0);
      return out;
    }
    const hours = (totalPct / 100) * bunkerCap / flow;
    const totalSeconds = Math.max(1, Math.floor(hours * 3600));
    for(let r = numRows-1; r >= 0; r--){
      const rowIndex = r;
      const pct = Number(rows[rowIndex] && rows[rowIndex].percentages ? (rows[rowIndex].percentages[bIndex] || 0) : 0);
      if(pct <= 0) out.push(0);
      else {
        const sec = Math.max(0, Math.floor(totalSeconds * (pct / Math.max(0.000001, totalPct))));
        out.push(sec);
      }
    }
    return out;
  }

  function updateClientBunkerLayerTimers(bIndex, layerSeconds, remainingForLayerIndex, remainingSecondsForLayer){
    setClientBunkers(prev => {
      const next = prev.map(p => ({ layers: Array.isArray(p.layers) ? [...p.layers] : [] }));
      const layers = next[bIndex].layers || [];
      for(let li=0; li<layerSeconds.length; li++){
        const mappedRow = (numRows - li);
        const old = layers[li] || { rowIndex: mappedRow, coal: '', percent: 0 };
        const raw = layerSeconds[li];
        const useRaw = (li === remainingForLayerIndex) ? Math.max(0, Math.round(remainingSecondsForLayer || 0)) : Math.max(0, Math.round(raw || 0));
        layers[li] = {
          rowIndex: old.rowIndex || mappedRow,
          coal: old.coal || '',
          percent: Number(old.percent || 0),
          rawSeconds: useRaw,
          timer: formatHMS(useRaw)
        };
      }

      // compare prev[bIndex].layers and layers; if identical return prev
      const prevLayers = (prev[bIndex] && Array.isArray(prev[bIndex].layers)) ? prev[bIndex].layers : [];
      const identical = prevLayers.length === layers.length && prevLayers.every((pl, idx) => {
        const nl = layers[idx];
        return pl && nl && pl.rawSeconds === nl.rawSeconds && pl.timer === nl.timer && Number(pl.percent || 0) === Number(nl.percent || 0);
      });
      if (identical) return prev;

      next[bIndex].layers = layers;
      return next;
    });
  }

  function decrementPercentagesBy(bIndex, lossThisSecond){
    setClientBunkers(prev => {
      const next = prev.map(p => ({ layers: Array.isArray(p.layers) ? [...p.layers] : [] }));
      const layers = next[bIndex].layers || [];
      let currentIdx = -1;
      for(let i=0;i<layers.length;i++){
        if((layers[i].rawSeconds || 0) > 0) { currentIdx = i; break; }
      }
      if(currentIdx === -1) {
        if(layers.length) currentIdx = layers.length - 1;
      }
      if(currentIdx >= 0 && layers[currentIdx]){
        const oldPct = Number(layers[currentIdx].percent || 0);
        const newPct = Math.max(0, oldPct - Number(lossThisSecond || 0));
        if (newPct !== oldPct) {
          layers[currentIdx].percent = newPct;
          next[bIndex].layers = layers;
          return next;
        }
      }
      return prev;
    });
  }

  function clearBunkerTimer(bIndex, dueToExpiry=false){
    const t = timersRef.current[bIndex];
    if(!t) return;
    if(t.intervalId) { clearInterval(t.intervalId); t.intervalId = null; t.running = false; }
    t.remaining = 0;
    t.lastKnownTotalSeconds = 0;
  }

  function setBunkerTimer(bIndex, fullSeconds, startTotalPct) {
    const t = timersRef.current[bIndex];
    const secs = Math.max(1, Math.floor(Number(fullSeconds) || 0));
    if(t.intervalId && Math.abs((t.lastKnownTotalSeconds||0) - secs) <= 1){
      t.startTotalPct = Number(startTotalPct) || t.startTotalPct || 0;
      return;
    }
    if(t.intervalId) clearBunkerTimer(bIndex);
    t.remaining = secs;
    t.lastKnownTotalSeconds = secs;
    t.startTotalPct = Number(startTotalPct) || 0;
    t.running = true;

    const layerSecs = computeLayerSecondsForBunker(bIndex);
    let currentLayer = -1;
    for(let li=0; li<layerSecs.length; li++){
      if(layerSecs[li] > 0) { currentLayer = li; break; }
    }
    let layerRemaining = (currentLayer >= 0) ? layerSecs[currentLayer] : 0;

    updateClientBunkerLayerTimers(bIndex, layerSecs, currentLayer, layerRemaining);

    t.intervalId = setInterval(() => {
      const remainingSec = Math.max(1, Math.floor(t.remaining || 1));
      let currentTotal = getTotalPercentForBunker(bIndex);
      const lossThisSecond = currentTotal / remainingSec;
      if(lossThisSecond > 0){
        decrementPercentagesBy(bIndex, lossThisSecond);
      }

      if(layerRemaining <= 0) {
        let nextLayer = -1;
        for(let li=currentLayer+1; li<layerSecs.length; li++){
          if(layerSecs[li] > 0) { nextLayer = li; break; }
        }
        currentLayer = nextLayer;
        layerRemaining = (currentLayer >= 0) ? layerSecs[currentLayer] : 0;
      } else {
        layerRemaining = Math.max(0, Math.floor(layerRemaining - 1));
      }

      t.remaining = Math.max(0, Math.floor(t.remaining - 1));
      updateClientBunkerLayerTimers(bIndex, layerSecs, currentLayer, layerRemaining);

      if(t.remaining <= 0){
        clearBunkerTimer(bIndex, true);
      }
    }, 1000);
  }

  function computeSecondsToEmpty(bIndex){
    const totalPct = getTotalPercentForBunker(bIndex);
    const flow = Number((flows && flows[bIndex]) || 0);
    const bunkerCap = Number(bunkerCapacity || 0);
    if(totalPct <= 0 || bunkerCap <= 0 || flow <= 0) return 0;
    const hours = (totalPct / 100) * bunkerCap / flow;
    const seconds = Math.max(1, Math.floor(hours * 3600));
    return seconds;
  }

  function computeAllAndStart(){
    for(let i=0;i<numBunkers;i++){
      const secs = computeSecondsToEmpty(i);
      if(secs > 0) setBunkerTimer(i, secs, getTotalPercentForBunker(i));
      else clearBunkerTimer(i);
    }
  }

  useEffect(() => {
    computeAllAndStart();
    return () => {
      for(let i=0;i<numBunkers;i++){
        const t = timersRef.current[i];
        if(t && t.intervalId) clearInterval(t.intervalId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, flows, bunkerCapacity]);

  return {
    computeAllAndStart,
    computeSecondsToEmpty,
    clearBunkerTimer,
    setBunkerTimer
  };
}
