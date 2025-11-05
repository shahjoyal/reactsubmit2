import React from 'react'
import { useUnit } from '../context/UnitContext'

export default function UnitSelector(){
  const { unit, setUnit } = useUnit();
  return (
    <div>
      {[1,2,3].map(u => (
        <button key={u} className={`unit-btn ${unit===u? 'active':''}`} onClick={()=>setUnit(u)}>Unit {u}</button>
      ))}
    </div>
  )
}
