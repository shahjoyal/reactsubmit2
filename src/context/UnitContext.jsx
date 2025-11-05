import React, { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/apiClient'

const UnitContext = createContext();

export function UnitProvider({ children }){
  const [unitsMap, setUnitsMap] = useState({});
  const [unit, setUnit] = useState(Number(localStorage.getItem('currentUnit') || 1));

  useEffect(()=>{
    (async ()=>{
      try{
        const map = await api.getUnitsMap().catch(()=>({}));
        if(!map || Object.keys(map).length < 3){
          const r = await api.initUnits().catch(()=>null);
          if(r && r.map) setUnitsMap(r.map);
          else setUnitsMap(map || {});
        } else {
          setUnitsMap(map);
        }
      }catch(e){ console.warn('units init failed', e) }
    })()
  },[])

  useEffect(()=>{ localStorage.setItem('currentUnit', String(unit)) }, [unit])

  const getBlendIdFor = (u) => unitsMap && unitsMap[String(u)] ? unitsMap[String(u)] : null;

  return <UnitContext.Provider value={{ unit, setUnit, unitsMap, setUnitsMap, getBlendIdFor }}>{children}</UnitContext.Provider>
}
export function useUnit(){ return useContext(UnitContext) }
