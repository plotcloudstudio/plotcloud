// Roof snow and wind on the main structure (2026-11-23), National Building Code of Canada 2020, Division B, Part 4, as printed in
// NR24-28/2020E-PDF (Canadian Commission on Building and Fire Codes, 2022). Pure functions; the site's climatic values (S_s, S_r, q)
// come from the user, from NBC Appendix C Table C-2 or the provincial code (Sentences 4.1.6.2.(1) and 4.1.7.3.(4) refer to
// Subsection 1.1.3.).

// Table 4.1.6.2.-A and Table 4.1.7.3.: importance factors at ULS (SLS: snow 0.9, wind 0.75 for every category)
export const IMPORTANCE = { Low: { Is: 0.8, Iw: 0.8 }, Normal: { Is: 1, Iw: 1 }, High: { Is: 1.15, Iw: 1.15 }, 'Post-disaster': { Is: 1.25, Iw: 1.25 } };
// Table 4.1.2.1.: elementary, middle and secondary schools and community centres are High Importance; the study's other occupancies Normal
export const importanceOf = (use) => (use === 'Education' ? 'High' : 'Normal');

// Sentence 4.1.6.2.(2): the characteristic length l_c = 2w − w²/l (w, l the smaller and larger plan dimensions of the roof, m) and
// C_b = 0.8 for l_c ≤ 70/C_w², else C_b = (1/C_w)[1 − (1 − 0.8 C_w) exp(−(l_c C_w² − 70)/100)]
export const charLength = (a, b) => { const w = Math.min(a, b), l = Math.max(a, b); return l > 0 ? 2 * w - (w * w) / l : 0; };
export function basicRoofFactor(lc, Cw = 1) { return lc <= 70 / (Cw * Cw) ? 0.8 : (1 / Cw) * (1 - (1 - 0.8 * Cw) * Math.exp(-(lc * Cw * Cw - 70) / 100)); }
// Sentence 4.1.6.2.(5): slope factor for roofs other than unobstructed slippery ones
export const slopeFactor = (deg) => (deg <= 30 ? 1 : deg <= 70 ? (70 - deg) / 40 : 0);
// Sentence 4.1.6.2.(1): S = I_s [S_s (C_b C_w C_s C_a) + S_r], S_r not greater than S_s (C_b C_w C_s C_a). C_a = 1 is the uniform
// load case of Sentence (8): drifts at steps, projections and valleys are not included.
export function roofSnow({ Ss, Sr = 0, Is = 1, roofW, roofL, Cw = 1, slope = 0, Ca = 1 }) {
  const lc = charLength(roofW, roofL), Cb = basicRoofFactor(lc, Cw), Cs = slopeFactor(slope), base = Ss * Cb * Cw * Cs * Ca, SrUsed = Math.min(Sr, base);
  return { S: Is * (base + SrUsed), lc, Cb, Cw, Cs, Ca, Is, SrUsed, SrCapped: Sr > base };
}

// Sentence 4.1.7.3.(5): exposure factor at reference height h (m): open terrain (h/10)^0.2, not less than 0.9; rough terrain
// (suburban, urban or wooded, extending upwind at least 1 km or 20 times the building height) 0.7(h/12)^0.3, not less than 0.7
export function exposureCe(h, terrain) { return terrain === 'open' ? Math.max(0.9, Math.pow(h / 10, 0.2)) : Math.max(0.7, 0.7 * Math.pow(h / 12, 0.3)); }
export const NBC_TERRAIN = { open: 'open', suburban: 'rough', city: 'rough' };
// Sentence 4.1.7.3.(6)(a): for a building no higher than 20 m and lower than its smaller plan dimension, h is the mid-height of the
// roof (the roof height for a flat roof), not less than 6 m; otherwise the study takes the building height (Clause (b)(i) at the top)
export const referenceHeight = (H, smallerPlan) => (H <= 20 && H < smallerPlan ? Math.max(6, H) : H);
// Sentence 4.1.7.5.(2): main structural system, H the building height and D its width parallel to the wind
export function cpWindward(HD) { return HD < 0.25 ? 0.6 : HD < 1 ? 0.27 * (HD + 2) : 0.8; }
export function cpLeeward(HD) { return HD < 0.25 ? -0.3 : HD < 1 ? -0.27 * (HD + 0.88) : -0.5; }
// Sentences 4.1.7.3.(1), (2), (8): p = I_w q C_e C_t C_g C_p, C_g = 2.0 for the building as a whole; the net load is the windward
// pressure less the leeward suction. C_t = 1 (no hill or escarpment, Article 4.1.7.4.)
export function netWind({ q, Iw = 1, H, D, smallerPlan, terrain = 'rough', Ct = 1, Cg = 2 }) {
  const h = referenceHeight(H, smallerPlan), Ce = exposureCe(h, terrain), HD = H / D, CpW = cpWindward(HD), CpL = cpLeeward(HD), base = Iw * q * Ce * Ct * Cg;
  return { p: base * (CpW - CpL), pW: base * CpW, pL: base * CpL, h, Ce, CpW, CpL, Cg, Ct, Iw, HD };
}
