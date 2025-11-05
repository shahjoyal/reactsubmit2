import React from 'react'

function buildLayersForBunker(state, index){
  // build layers based on rows and percentages (bottom->top)
  const rows = state.rows || [];
  const layers = [];
  for(let r=0;r<rows.length;r++){
    const pct = (rows[r].percentages && rows[r].percentages[index]) ? Number(rows[r].percentages[index]) : 0;
    if(pct > 0){
      layers.push({ rowIndex: r+1, coal: rows[r].coal || '', percent: pct, gcv: rows[r].gcv || 0, cost: rows[r].cost || 0 })
    }
  }
  return layers;
}

export default function BunkerCard({ index, state }){
  const layers = buildLayersForBunker(state, index);

  return (
    <div className="bunker">
      <div><strong>Bunker {index+1}</strong></div>
      <svg viewBox="0 0 100 150" preserveAspectRatio="xMidYMid meet">
        <defs></defs>
        {/* simple stacked rectangles bottom->top for preview */}
        {(()=>{
          const totalH = 120; let y = 140; const rects = [];
          for(let i=layers.length-1;i>=0;i--){
            const h = (layers[i].percent/100) * totalH;
            y -= h;
            rects.push(<rect key={i} x={10} y={y} width={80} height={h} fill={"#"+((i*1234567)%0xFFFFFF).toString(16).padStart(6,'0')} />)
          }
          return rects;
        })()}
      </svg>
      <div className="small">Layers: {layers.length}</div>
    </div>
  )
}
