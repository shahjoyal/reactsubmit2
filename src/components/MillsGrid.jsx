// src/components/MillsGrid.jsx
import React from 'react';

export default function MillsGrid({ flows = [], setFlows, totals = [], timers = [], formatTime = (s) => s ? s : '--' }) {
  const num = 8;
  function updateFlow(i, v) {
    const val = Number(v) || 0;
    setFlows(prev => {
      const next = Array.isArray(prev) ? [...prev] : Array(num).fill(0);
      next[i] = val;
      return next;
    });
  }

  return (
    <div className="mills-grid" style={{ marginTop: 8 }}>
      {/* first column header (empty placeholder to align) */}
      <div style={{ gridColumn: '1 / 2' }} />

      {/* columns for M1..M8 headers hidden by CSS but grid positions are used */}
      {Array.from({ length: num }).map((_, i) => (
        <div key={'header-' + i} className="mill" style={{ display: 'none' }} data-mill={i}></div>
      ))}

      {/* Row 1: Coal Flow (inputs) */}
      <div className="mill coal-flow">Coal Flow</div>
      {Array.from({ length: num }).map((_, i) => (
        <div key={'flow-' + i} className="mill" data-mill={i}>
          <input className="flow-input" data-mill={i} value={flows[i] || ''} onChange={(e)=>updateFlow(i,e.target.value)} placeholder="TPH" />
        </div>
      ))}

      {/* Row 2: Next Timer */}
      <div className="mill next-timer">Bunker Empty in </div>
      {Array.from({ length: num }).map((_, i) => (
        <div key={'timer-' + i} className="mill" data-mill={i}>
          <input className="timer-input" readOnly value={timers[i] ? formatTime(timers[i]) : '--'} />
        </div>
      ))}

      {/* Row 3: Total Percent */}
      <div className="mill bunker-total">Total %</div>
      {Array.from({ length: num }).map((_, i) => (
        <div key={'total-' + i} className="mill" data-mill={i}>
          <input className="total-input" readOnly value={(Number(totals[i]||0)).toFixed(2) + '%'} />
        </div>
      ))}
    </div>
  );
}
