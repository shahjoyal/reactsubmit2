// src/utils/calcAFT.js
/**
 * Frontend AFT calculation — ports the server-side formula you provided.
 * Input: an object with oxide fields (SiO2, Al2O3, Fe2O3, CaO, MgO, Na2O, K2O, SO3, TiO2).
 * Returns numeric AFT (0 if no oxide data present).
 */
export default function calcAFT(ox = {}) {
  // normalize keys (accept string/number variants)
  const getNum = (k) => {
    if (!ox) return 0;
    const v = ox[k];
    return Number(v || 0);
  };

  const total = Object.keys(ox || {}).reduce((s, k) => s + (Number(ox[k]) || 0), 0);
  if (total === 0) return 0;

  const SiO2 = getNum('SiO2') || 0;
  const Al2O3 = getNum('Al2O3') || 0;
  const Fe2O3 = getNum('Fe2O3') || 0;
  const CaO = getNum('CaO') || 0;
  const MgO = getNum('MgO') || 0;
  const Na2O = getNum('Na2O') || 0;
  const K2O = getNum('K2O') || 0;
  const SO3 = getNum('SO3') || 0;
  const TiO2 = getNum('TiO2') || 0;

  const sum = SiO2 + Al2O3;
  let aft = 0;

  if (sum < 55) {
    aft = 1245 + (1.1 * SiO2) + (0.95 * Al2O3) - (2.5 * Fe2O3) - (2.98 * CaO) - (4.5 * MgO)
      - (7.89 * (Na2O + K2O)) - (1.7 * SO3) - (0.63 * TiO2);
  } else if (sum < 75) {
    aft = 1323 + (1.45 * SiO2) + (0.683 * Al2O3) - (2.39 * Fe2O3) - (3.1 * CaO) - (4.5 * MgO)
      - (7.49 * (Na2O + K2O)) - (2.1 * SO3) - (0.63 * TiO2);
  } else {
    aft = 1395 + (1.2 * SiO2) + (0.9 * Al2O3) - (2.5 * Fe2O3) - (3.1 * CaO) - (4.5 * MgO)
      - (7.2 * (Na2O + K2O)) - (1.7 * SO3) - (0.63 * TiO2);
  }

  return Number(aft);
}
