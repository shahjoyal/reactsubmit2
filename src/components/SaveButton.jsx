import React from 'react'
import api from '../api/apiClient'
import { useUnit } from '../context/UnitContext'

export default function SaveButton({ buildPayload }){
  const { unit, getBlendIdFor } = useUnit();

  async function handleSave(e){
    e && e.preventDefault();
    const payload = buildPayload();
    const blendId = getBlendIdFor(unit);
    try{
      const res = await api.saveBlend(payload, { blendId });
      // store to local cache like original app
      const cache = JSON.parse(localStorage.getItem('payloadCache') || '{}');
      cache[unit] = payload;
      localStorage.setItem('payloadCache', JSON.stringify(cache));
      alert('Saved (unit: ' + unit + ')');
    }catch(err){ console.error(err); alert('Save failed: ' + (err.message || err)) }
  }

  return <button className="btn btn-primary" onClick={handleSave}>Submit</button>
}
