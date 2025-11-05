// // // src/api/apiClient.js
// // const envBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ? import.meta.env.VITE_API_BASE : '';
// // const DEFAULT_FALLBACK = 'http://localhost:3000';
// // const BASE = (envBase && envBase.trim() !== '') ? envBase.replace(/\/$/, '') : DEFAULT_FALLBACK;
// // const API_BASE = (BASE ? BASE.replace(/\/$/, '') : '') + '/api';

// // function log(...args){ try{ console.debug('[apiClient]', ...args); }catch(e){} }

// // async function safeJson(res){
// //   const txt = await res.text();
// //   try { return JSON.parse(txt); } catch(e){ return txt; }
// // }

// // async function _fetch(url){
// //   try {
// //     log('fetch', url);
// //     const res = await fetch(url);
// //     if (!res.ok) {
// //       log('non-ok', url, res.status, res.statusText);
// //       return null;
// //     }
// //     const data = await safeJson(res);
// //     return data;
// //   } catch (err) {
// //     log('fetch error', url, err && err.message ? err.message : err);
// //     return null;
// //   }
// // }

// // /**
// //  * getCoals()
// //  * - hits /api/coals (server returned JSON array of full coal docs)
// //  * - falls back to some other common endpoints if needed
// //  * - sets window.COAL_DB for global access
// //  */
// // export async function getCoals(){
// //   const candidates = [
// //     API_BASE + '/coals',       // your working endpoint
// //     API_BASE + '/coal',
// //     API_BASE + '/coalnames',
// //     API_BASE + '/coal/list',
// //     API_BASE + '/coals/list'
// //   ];
// //   for (const url of candidates) {
// //     const data = await _fetch(url);
// //     if (!data) continue;
// //     // normalize to array
// //     if (Array.isArray(data)) {
// //       try { window.COAL_DB = data; } catch(e){}
// //       log('getCoals success from', url, 'count=', data.length);
// //       return data;
// //     }
// //     // object -> maybe contains list
// //     if (data && typeof data === 'object') {
// //       const list = data.coals || data.data || data.items || data.docs || data.list;
// //       if (Array.isArray(list)) {
// //         try { window.COAL_DB = list; } catch(e){}
// //         log('getCoals success nested from', url, 'count=', list.length);
// //         return list;
// //       }
// //       try { window.COAL_DB = [data]; } catch(e){}
// //       return [data];
// //     }
// //   }
// //   // nothing found
// //   try { window.COAL_DB = window.COAL_DB || []; } catch(e){}
// //   log('getCoals none found. API_BASE=', API_BASE);
// //   return window.COAL_DB || [];
// // }

// // export async function getUnitsMap(){
// //   const data = await _fetch(API_BASE + '/units');
// //   return data || {};
// // }
// // export async function initUnits(){ const res = await fetch(API_BASE + '/units/init', { method: 'POST' }); return safeJson(res); }
// // export async function getBlend(id){ const res = await fetch(API_BASE + `/blend/${id}`); return safeJson(res); }
// // export async function saveBlend(payload, { blendId } = {}) {
// //   if (blendId) {
// //     const res = await fetch(API_BASE + `/blend/${blendId}`, { method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
// //     return safeJson(res);
// //   }
// //   const res = await fetch(API_BASE + `/blend`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
// //   return safeJson(res);
// // }

// // export default { getCoals, getUnitsMap, initUnits, getBlend, saveBlend };


// // src/api/apiClient.js
// /* Centralized API client used by the React app.
//    Resolves base URL via VITE_API_BASE or REACT_APP_API_BASE env, else uses http://localhost:3000
// */

// // const envBase = (typeof import !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_API_BASE)
// //   ? import.meta.env.VITE_API_BASE
// //   : (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE ? process.env.REACT_APP_API_BASE : '');
// //const envBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ? import.meta.env.VITE_API_BASE : '';
// // src/api/apiClient.js
// /* Robust API client that will try a few likely backend base URLs
//    so your frontend doesn't accidentally call the Vite dev server root.
// */

// const envBase = (typeof import.meta !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_API_BASE)
//   ? import.meta.env.VITE_API_BASE
//   : (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE ? process.env.REACT_APP_API_BASE : '');

// const DEFAULT_FALLBACK = 'http://localhost:3000';
// const ALT_FALLBACK = 'http://localhost:5000';

// // cleaned base used as first preference
// const PREFERRED_BASE = envBase && String(envBase).trim() !== '' ? String(envBase).replace(/\/$/, '') : DEFAULT_FALLBACK;
// const CANDIDATE_BASES = [
//   // 1) explicit env / developer-configured base
//   PREFERRED_BASE,
//   // 2) fallback localhost:3000 and 5000
//   DEFAULT_FALLBACK,
//   ALT_FALLBACK,
//   // 3) same origin with /api (useful if backend served from same host in production)
//   (typeof window !== 'undefined' && window.location ? `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':'+window.location.port : ''}` : null)
// ].filter(Boolean).map(b => b.replace(/\/$/, ''));

// // helper to try full url with candidate bases until one returns a non-404/non-network error
// async function tryFetchWithBases(path, opts = {}) {
//   // path expected to start with '/api' or similar; normalize
//   const p = path.startsWith('/') ? path : `/${path}`;
//   let lastErr = null;
//   for (const base of CANDIDATE_BASES) {
//     const url = base + p;
//     try {
//       const res = await fetch(url, opts);
//       // treat 404 (or other 4xx) as "not found on this server" -> try next candidate
//       if (!res.ok) {
//         // if 404 or 501 etc, capture and try next
//         lastErr = { url, status: res.status, statusText: res.statusText, body: await safeJson(res).catch(()=>null) };
//         // try next candidate
//         continue;
//       }
//       // success (2xx)
//       const data = await safeJson(res);
//       return { data, url };
//     } catch (err) {
//       lastErr = { url, message: err && err.message ? err.message : String(err) };
//       // try next candidate
//       continue;
//     }
//   }
//   // none found
//   const e = new Error('All candidate API endpoints failed');
//   e.details = lastErr;
//   throw e;
// }

// async function safeJson(res){
//   const txt = await res.text();
//   try { return JSON.parse(txt); } catch(e){ return txt; }
// }

// function log(...args) { try { console.debug('[apiClient]', ...args); } catch (e) {} }

// // Public helpers
// export async function getCoals() {
//   try {
//     const res = await tryFetchWithBases('/api/coals', { method: 'GET' });
//     log('getCoals from', res.url);
//     if (Array.isArray(res.data)) {
//       try { window.COAL_DB = res.data; } catch(e){}
//       return res.data;
//     }
//     // normalize
//     if (res.data && typeof res.data === 'object') {
//       const list = res.data.coals || res.data.data || res.data.items || res.data.docs || res.data.list;
//       if (Array.isArray(list)) {
//         try { window.COAL_DB = list; } catch(e){}
//         return list;
//       }
//       return [res.data];
//     }
//     return [];
//   } catch (err) {
//     log('getCoals error', err);
//     return window.COAL_DB || [];
//   }
// }

// export async function getCoalNames() {
//   try {
//     const res = await tryFetchWithBases('/api/coalnames', { method: 'GET' });
//     return Array.isArray(res.data) ? res.data : (res.data && res.data.coal ? [res.data] : []);
//   } catch (err) {
//     log('getCoalNames error', err);
//     return [];
//   }
// }

// export async function getUnit(unit) {
//   if (![1,2,3].includes(Number(unit))) throw new Error('unit must be 1,2 or 3');
//   try {
//     const res = await tryFetchWithBases(`/api/unit/${unit}`, { method: 'GET' });
//     return res.data;
//   } catch (err) {
//     log('getUnit error', err);
//     throw new Error('Failed to load unit ' + unit);
//   }
// }

// export async function submitUnit(unit, payload) {
//   if (![1,2,3].includes(Number(unit))) throw new Error('unit must be 1,2 or 3');
//   try {
//     // try the /api/submit/:unit endpoint first (if your server supports it)
//     const trySubmit = await tryFetchWithBases(`/api/submit/${unit}`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload)
//     });
//     return trySubmit.data;
//   } catch (err) {
//     log('submitUnit fallback to creating blend manually', err);
//     // fallback behavior: create blend then map to unit (older server flow)
//     // 1) create blend
//     const created = await tryFetchWithBases('/api/blend', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload)
//     });
//     const createdData = created.data;
//     const newId = createdData && (createdData.id || createdData._id) ? (createdData.id || createdData._id) : null;
//     if (!newId) throw new Error('Failed to create blend on any candidate base');
//     // 2) map to unit via PUT /api/units/:unit
//     const mapResp = await tryFetchWithBases(`/api/units/${unit}`, {
//       method: 'PUT',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ blendId: newId })
//     });
//     return { created: createdData, mapped: mapResp.data, id: newId };
//   }
// }

// // Expose PUT mapping if code wants to call directly
// export async function putUnitMapping(unit, blendId) {
//   if (![1,2,3].includes(Number(unit))) throw new Error('unit must be 1,2 or 3');
//   try {
//     const res = await tryFetchWithBases(`/api/units/${unit}`, {
//       method: 'PUT',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ blendId })
//     });
//     return res.data;
//   } catch (err) {
//     log('putUnitMapping error', err);
//     throw err;
//   }
// }

// /* Generic blend helpers */
// export async function saveBlend(payload, { blendId } = {}) {
//   if (blendId) {
//     // PUT /api/blend/:id on whichever base works
//     const res = await tryFetchWithBases(`/api/blend/${blendId}`, {
//       method: 'PUT',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload)
//     });
//     return res.data;
//   } else {
//     const res = await tryFetchWithBases('/api/blend', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload)
//     });
//     return res.data;
//   }
// }

// export async function getLatestBlend() {
//   try {
//     const res = await tryFetchWithBases('/api/blend/latest', { method: 'GET' });
//     return res.data;
//   } catch (err) {
//     log('getLatestBlend error', err);
//     return null;
//   }
// }

// // convenience default export
// export default {
//   getCoals,
//   getCoalNames,
//   getUnit,
//   submitUnit,
//   putUnitMapping,
//   saveBlend,
//   getLatestBlend
// };

// src/api/apiClient.js
const envBase = (typeof import.meta !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_API_BASE)
  ? import.meta.env.VITE_API_BASE
  : (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE ? process.env.REACT_APP_API_BASE : '');

const DEFAULT_FALLBACK = 'http://localhost:3000';
const ALT_FALLBACK = 'http://localhost:5000';

const PREFERRED_BASE = envBase && String(envBase).trim() !== '' ? String(envBase).replace(/\/$/, '') : DEFAULT_FALLBACK;
const CANDIDATE_BASES = [
  PREFERRED_BASE,
  DEFAULT_FALLBACK,
  ALT_FALLBACK,
  (typeof window !== 'undefined' && window.location ? `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':'+window.location.port : ''}` : null)
].filter(Boolean).map(b => b.replace(/\/$/, ''));

async function tryFetchWithBases(path, opts = {}) {
  const p = path.startsWith('/') ? path : `/${path}`;
  let lastErr = null;
  for (const base of CANDIDATE_BASES) {
    const url = base + p;
    try {
      const res = await fetch(url, opts);
      if (!res.ok) {
        lastErr = { url, status: res.status, statusText: res.statusText, body: await safeJson(res).catch(()=>null) };
        continue;
      }
      const data = await safeJson(res);
      return { data, url };
    } catch (err) {
      lastErr = { url, message: err && err.message ? err.message : String(err) };
      continue;
    }
  }
  const e = new Error('All candidate API endpoints failed');
  e.details = lastErr;
  throw e;
}

async function safeJson(res){
  const txt = await res.text();
  try { return JSON.parse(txt); } catch(e){ return txt; }
}

function log(...args) { try { console.debug('[apiClient]', ...args); } catch (e) {} }

export async function getCoals() {
  try {
    const res = await tryFetchWithBases('/api/coals', { method: 'GET' });
    log('getCoals from', res.url);
    if (Array.isArray(res.data)) {
      try { window.COAL_DB = res.data; } catch(e){}
      return res.data;
    }
    if (res.data && typeof res.data === 'object') {
      const list = res.data.coals || res.data.data || res.data.items || res.data.docs || res.data.list;
      if (Array.isArray(list)) {
        try { window.COAL_DB = list; } catch(e){}
        return list;
      }
      return [res.data];
    }
    return [];
  } catch (err) {
    log('getCoals error', err);
    return window.COAL_DB || [];
  }
}

export async function getCoalNames() {
  try {
    const res = await tryFetchWithBases('/api/coalnames', { method: 'GET' });
    return Array.isArray(res.data) ? res.data : (res.data && res.data.coal ? [res.data] : []);
  } catch (err) {
    log('getCoalNames error', err);
    return [];
  }
}

export async function getUnit(unit) {
  if (![1,2,3].includes(Number(unit))) throw new Error('unit must be 1,2 or 3');
  try {
    const res = await tryFetchWithBases(`/api/unit/${unit}`, { method: 'GET' });
    return res.data;
  } catch (err) {
    log('getUnit error', err);
    throw new Error('Failed to load unit ' + unit);
  }
}

export async function submitUnit(unit, payload) {
  if (![1,2,3].includes(Number(unit))) throw new Error('unit must be 1,2 or 3');
  try {
    const trySubmit = await tryFetchWithBases(`/api/submit/${unit}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return trySubmit.data;
  } catch (err) {
    log('submitUnit fallback to creating blend manually', err);
    // fallback create blend then map
    const createdData = created.data;
    const newId = createdData && (createdData.id || createdData._id) ? (createdData.id || createdData._id) : null;
    if (!newId) throw new Error('Failed to create blend on any candidate base');
    const mapResp = await tryFetchWithBases(`/api/units/${unit}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blendId: newId })
    });
    return { created: createdData, mapped: mapResp.data, id: newId };
  }
}

export async function putUnitMapping(unit, blendId) {
  if (![1,2,3].includes(Number(unit))) throw new Error('unit must be 1,2 or 3');
  try {
    const res = await tryFetchWithBases(`/api/units/${unit}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blendId })
    });
    return res.data;
  } catch (err) {
    log('putUnitMapping error', err);
    throw err;
  }
}

// export async function saveBlend(payload, { blendId } = {}) {
//   if (blendId) {
//     const res = await tryFetchWithBases(`/api/blend/${blendId}`, {
//       method: 'PUT',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload)
//     });
//     return res.data;
//   } else {
//     const res = await tryFetchWithBases('/api/blend', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload)
//     });
//     return res.data;
//   }
// }

// export async function getLatestBlend() {
//   try {
//     const res = await tryFetchWithBases('/api/blend/latest', { method: 'GET' });
//     return res.data;
//   } catch (err) {
//     log('getLatestBlend error', err);
//     return null;
//   }
// }

export default {
  getCoals,
  getCoalNames,
  getUnit,
  submitUnit,
  putUnitMapping
};
