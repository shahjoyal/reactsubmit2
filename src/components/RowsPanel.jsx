// src/components/RowsPanel.jsx
import React from 'react';

export default function RowsPanel({ rows = [], setRowCoal, setRowPercent, setRowGcv, setRowCost, coals = [] }) {
  return (
    <div style={{ marginTop: 16, paddingTop: 8, borderTop: '1px dashed #eee' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 140 }}><strong>Rows / Mills</strong></div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ width: 60, textAlign: 'center' }}>M{i+1}</div>
        ))}
        <div style={{ width: 80, textAlign: 'center', display: 'none' }}>GCV</div>
        <div style={{ width: 80, textAlign: 'center', display: 'none' }}>Cost</div>
      </div>

      {rows.map((row, rIdx) => (
        <div key={rIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 140 }}>
            <div>Row {rIdx + 1}</div>
            <select value={row.coal || ''} onChange={(e) => setRowCoal(rIdx, e.target.value)} style={{ display: 'none' }}>
              <option value="">Select coal</option>
              {coals.map(c => <option key={c._id || c.coal} value={c._id || c.coal}>{c.coal || c.name}</option>)}
            </select>
          </div>

          {Array.from({ length: 8 }).map((_, mIdx) => (
            <div key={mIdx} style={{ width: 60 }}>
              <input
                type="number"
                step="0.1"
                className="percentage-input"
                data-row={rIdx + 1}
                data-mill={mIdx}
                value={row.percentages[mIdx] || ''}
                onChange={(e) => setRowPercent(rIdx, mIdx, e.target.value)}
                placeholder="%"
                style={{ width: '100%' }}
              />
            </div>
          ))}

                    {/* New time input field */}
          <div style={{ width: 100 }}>
            <input
              type="time"
              value={row.time || ''}
              onChange={(e) => setRowTime(rIdx, e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ width: 80, display: 'none' }}>
            <input type="number" value={row.gcv || ''} onChange={(e) => setRowGcv(rIdx, e.target.value)} placeholder="GCV" />
          </div>
          <div style={{ width: 80, display: 'none' }}>
            <input type="number" value={row.cost || ''} onChange={(e) => setRowCost(rIdx, e.target.value)} placeholder="Cost" />
          </div>
        </div>
      ))}
    </div>
  );
}
