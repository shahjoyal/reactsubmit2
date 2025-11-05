import React from 'react'
import BunkerCard from './BunkerCard'

export default function BunkersPanel({ state, setState, coals }){
  const bunkers = state.bunkers || Array(8).fill({layers:[]});

  return (
    <div>
      <h4>Bunkers</h4>
      <div className="bunkers-grid">
        {Array.from({length:8}).map((_,i)=> (
          <BunkerCard key={i} index={i} state={state} setState={setState} coals={coals} />
        ))}
      </div>
    </div>
  )
}
