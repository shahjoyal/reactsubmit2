// import { useRef, useEffect } from 'react'

// // This hook implements the same timer algorithm used in the old app.
// export default function useBunkerTimers({ getTotalPercentForBunker, getFlowForBunker, getBunkerCapacity, bunkerCount=8 }){
//   const timers = useRef(Array.from({length:bunkerCount}).map(()=>({ intervalId: null, remaining: 0, lastKnownTotalSeconds:0, startTotalPct:0 })));

//   useEffect(()=>{
//     return ()=>{ timers.current.forEach(t=>{ if(t.intervalId) clearInterval(t.intervalId) }) }
//   },[])

//   function clearBunkerTimer(bIndex, dueToExpiry=false){
//     const t = timers.current[bIndex];
//     if(!t) return;
//     if(t.intervalId) { clearInterval(t.intervalId); t.intervalId = null }
//     t.remaining = 0; t.lastKnownTotalSeconds = 0; t.startTotalPct = 0;
//   }

//   function setBunkerTimer(bIndex, fullSeconds, startTotalPct){
//     bIndex = Number(bIndex);
//     if(isNaN(bIndex) || bIndex < 0 || bIndex >= timers.current.length) return;
//     const secs = Math.max(1, Math.floor(Number(fullSeconds) || 0));
//     const t = timers.current[bIndex];

//     if(t.intervalId && Math.abs((t.lastKnownTotalSeconds||0) - secs) <= 1){
//       t.startTotalPct = Number(startTotalPct) || t.startTotalPct || 0;
//       return;
//     }
//     if(t.intervalId) clearBunkerTimer(bIndex);

//     t.remaining = secs; t.lastKnownTotalSeconds = secs; t.startTotalPct = Number(startTotalPct) || 0;

//     t.intervalId = setInterval(()=>{
//       const currentTotal = getTotalPercentForBunker(bIndex);
//       const remainingSec = Math.max(1, Math.floor(t.remaining || 1));
//       const lossThisSecond = currentTotal / remainingSec;
//       if(lossThisSecond > 0){
//         // caller should provide a way to decrement actual percentages by amount
//         if(typeof getTotalPercentForBunker.__decrement === 'function') getTotalPercentForBunker.__decrement(bIndex, lossThisSecond);
//       }
//       t.remaining = Math.max(0, Math.floor(t.remaining - 1));
//       if(t.remaining <= 0){ clearBunkerTimer(bIndex, true) }
//     }, 1000)
//   }

//   function computeAndStartForBunker(bIndex){
//     const totalPct = getTotalPercentForBunker(bIndex);
//     const bunkerCap = getBunkerCapacity();
//     const flow = getFlowForBunker(bIndex);
//     if(totalPct <= 0 || bunkerCap <= 0 || flow <= 0){ clearBunkerTimer(bIndex); return 0 }
//     const hours = (totalPct / 100) * bunkerCap / flow;
//     const seconds = Math.max(1, Math.floor(hours * 3600));
//     setBunkerTimer(bIndex, seconds, totalPct);
//     return seconds;
//   }

//   function computeAllAndStart(){ for(let i=0;i<bunkerCount;i++) computeAndStartForBunker(i) }

//   return { computeAndStartForBunker, computeAllAndStart, setBunkerTimer, clearBunkerTimer }
// }


// src/hooks/bunkertimer.js
import { useRef, useEffect } from 'react'

export default function useBunkerTimers({ getTotalPercentForBunker, getFlowForBunker, getBunkerCapacity, bunkerCount=8 }) {
  const timers = useRef(Array.from({length:bunkerCount}).map(()=>({ intervalId: null, remaining: 0, lastKnownTotalSeconds:0, startTotalPct:0 })));

  useEffect(()=>{ return ()=>{ timers.current.forEach(t=>{ if(t.intervalId) clearInterval(t.intervalId) }) } },[])

  function clearBunkerTimer(bIndex, dueToExpiry=false){
    const t = timers.current[bIndex];
    if(!t) return;
    if(t.intervalId) { clearInterval(t.intervalId); t.intervalId = null }
    t.remaining = 0; t.lastKnownTotalSeconds = 0; t.startTotalPct = 0;
  }

  function setBunkerTimer(bIndex, fullSeconds, startTotalPct){
    bIndex = Number(bIndex);
    if(isNaN(bIndex) || bIndex < 0 || bIndex >= timers.current.length) return;
    const secs = Math.max(1, Math.floor(Number(fullSeconds) || 0));
    const t = timers.current[bIndex];

    if(t.intervalId && Math.abs((t.lastKnownTotalSeconds||0) - secs) <= 1){
      t.startTotalPct = Number(startTotalPct) || t.startTotalPct || 0;
      return;
    }
    if(t.intervalId) clearBunkerTimer(bIndex);

    t.remaining = secs; t.lastKnownTotalSeconds = secs; t.startTotalPct = Number(startTotalPct) || 0;

    t.intervalId = setInterval(()=> {
      const currentTotal = getTotalPercentForBunker(bIndex);
      const remainingSec = Math.max(1, Math.floor(t.remaining || 1));
      const lossThisSecond = currentTotal / remainingSec;
      if(lossThisSecond > 0){
        if(typeof getTotalPercentForBunker.__decrement === 'function') getTotalPercentForBunker.__decrement(bIndex, lossThisSecond);
      }
      t.remaining = Math.max(0, Math.floor(t.remaining - 1));
      if(t.remaining <= 0){ clearBunkerTimer(bIndex, true) }
    }, 1000)
  }

  function computeAndStartForBunker(bIndex){
    const totalPct = getTotalPercentForBunker(bIndex);
    const bunkerCap = getBunkerCapacity();
    const flow = getFlowForBunker(bIndex);
    if(totalPct <= 0 || bunkerCap <= 0 || flow <= 0){ clearBunkerTimer(bIndex); return 0 }
    const hours = (totalPct / 100) * bunkerCap / flow;
    const seconds = Math.max(1, Math.floor(hours * 3600));
    setBunkerTimer(bIndex, seconds, totalPct);
    return seconds;
  }

  function computeAllAndStart(){ for(let i=0;i<bunkerCount;i++) computeAndStartForBunker(i) }

  return { computeAndStartForBunker, computeAllAndStart, setBunkerTimer, clearBunkerTimer }
}
