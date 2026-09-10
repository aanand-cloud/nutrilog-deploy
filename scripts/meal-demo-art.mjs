/** Cuisine-accurate MealNova landing art — original SVG when real photos are unavailable. */

function plateScene(label, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fafafa"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <ellipse cx="400" cy="520" rx="260" ry="32" fill="#0f172a" opacity="0.06"/>
  <g filter="url(#shadow)">${inner}</g>
  <text x="400" y="56" text-anchor="middle" fill="#475569" font-family="Arial, sans-serif" font-size="18" font-weight="600" opacity="0.65">${label}</text>
</svg>`;
}

/** UK — fish, chips and mushy peas */
export function fishChipsSvg() {
  return plateScene('Fish, chips &amp; mushy peas', `
    <ellipse cx="400" cy="340" rx="250" ry="92" fill="#ffffff" stroke="#e2e8f0" stroke-width="3"/>
    <path d="M250 300 L330 280 L410 295 L480 285 L540 310 L500 360 L420 375 L340 370 L260 350 Z" fill="#fde68a" opacity="0.95"/>
    <path d="M270 310 L320 298 L380 308 L440 300 L490 318 L450 350 L380 358 L310 345 Z" fill="#fbbf24"/>
    <rect x="285" y="318" width="12" height="28" rx="4" fill="#f59e0b" transform="rotate(-8 291 332)"/>
    <rect x="310" y="312" width="12" height="32" rx="4" fill="#d97706" transform="rotate(6 316 328)"/>
    <rect x="335" y="316" width="12" height="30" rx="4" fill="#f59e0b"/>
    <rect x="360" y="310" width="12" height="34" rx="4" fill="#b45309" transform="rotate(-5 366 327)"/>
    <rect x="385" y="314" width="12" height="30" rx="4" fill="#f59e0b" transform="rotate(8 391 329)"/>
    <path d="M420 250 Q470 230 520 260 Q500 310 455 320 Q410 325 390 295 Q375 270 420 250 Z" fill="#fef3c7" stroke="#fcd34d" stroke-width="2"/>
    <path d="M435 265 Q465 252 495 270 Q480 300 450 305 Q420 308 410 285 Q405 272 435 265 Z" fill="#fde68a"/>
    <ellipse cx="280" cy="330" rx="52" ry="28" fill="#84cc16" opacity="0.85"/>
    <ellipse cx="265" cy="338" rx="38" ry="18" fill="#65a30d" opacity="0.75"/>
  `);
}

/** India — idli, sambar and coconut chutney */
export function idliSambarSvg() {
  return plateScene('Idli, sambar &amp; coconut chutney', `
    <ellipse cx="400" cy="350" rx="240" ry="86" fill="#ffffff" stroke="#e2e8f0" stroke-width="3"/>
    <ellipse cx="400" cy="360" rx="170" ry="52" fill="#ea580c" opacity="0.82"/>
    <ellipse cx="400" cy="365" rx="150" ry="42" fill="#c2410c" opacity="0.55"/>
    <circle cx="330" cy="300" r="28" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
    <circle cx="330" cy="300" r="20" fill="#ffffff"/>
    <circle cx="400" cy="285" r="30" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
    <circle cx="400" cy="285" r="22" fill="#ffffff"/>
    <circle cx="470" cy="300" r="28" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
    <circle cx="470" cy="300" r="20" fill="#ffffff"/>
    <ellipse cx="540" cy="330" rx="36" ry="22" fill="#fefce8" stroke="#fde68a" stroke-width="2"/>
    <ellipse cx="540" cy="332" rx="26" ry="14" fill="#ffffff" opacity="0.9"/>
  `);
}

/** Italy — pasta with tomato sauce and parmesan */
export function pastaTomatoSvg() {
  return plateScene('Pasta with tomato sauce &amp; parmesan', `
    <ellipse cx="400" cy="345" rx="245" ry="88" fill="#ffffff" stroke="#e2e8f0" stroke-width="3"/>
    <ellipse cx="400" cy="340" rx="150" ry="58" fill="#dc2626" opacity="0.78"/>
    <path d="M280 320 Q320 280 360 300 Q400 270 440 295 Q480 275 520 315 Q490 360 430 370 Q370 378 320 360 Q280 345 280 320 Z" fill="#ef4444" opacity="0.88"/>
    <path d="M300 330 Q340 305 380 322 Q420 300 460 328 Q440 355 390 362 Q340 368 310 350 Z" fill="#b91c1c" opacity="0.55"/>
    <ellipse cx="350" cy="318" rx="18" ry="10" fill="#fef3c7" opacity="0.95" transform="rotate(-20 350 318)"/>
    <ellipse cx="420" cy="308" rx="16" ry="9" fill="#fde68a" transform="rotate(12 420 308)"/>
    <ellipse cx="470" cy="325" rx="14" ry="8" fill="#fef9c3" transform="rotate(-8 470 325)"/>
  `);
}

/** East/Southeast Asia — Thai curry with jasmine rice */
export function thaiCurrySvg() {
  return plateScene('Thai curry with jasmine rice', `
    <ellipse cx="400" cy="345" rx="245" ry="88" fill="#ffffff" stroke="#e2e8f0" stroke-width="3"/>
    <ellipse cx="310" cy="340" rx="95" ry="62" fill="#fefce8" stroke="#fde68a" stroke-width="2"/>
    <ellipse cx="310" cy="340" rx="78" ry="48" fill="#ffffff"/>
    <ellipse cx="500" cy="345" rx="110" ry="68" fill="#ea580c" opacity="0.82"/>
    <ellipse cx="500" cy="350" rx="88" ry="50" fill="#c2410c" opacity="0.65"/>
    <circle cx="470" cy="330" r="10" fill="#84cc16" opacity="0.8"/>
    <circle cx="520" cy="338" r="8" fill="#22c55e" opacity="0.75"/>
    <circle cx="495" cy="360" r="9" fill="#4ade80" opacity="0.7"/>
    <path d="M455 318 L470 300 L485 318 L470 328 Z" fill="#fbbf24" opacity="0.85"/>
  `);
}

/** Middle East — grilled chicken, rice, hummus and salad */
export function middleEastPlateSvg() {
  return plateScene('Grilled chicken, rice, hummus &amp; salad', `
    <ellipse cx="400" cy="345" rx="245" ry="88" fill="#ffffff" stroke="#e2e8f0" stroke-width="3"/>
    <ellipse cx="290" cy="345" rx="78" ry="58" fill="#fefce8" stroke="#fde68a" stroke-width="2"/>
    <ellipse cx="290" cy="345" rx="62" ry="44" fill="#ffffff"/>
    <ellipse cx="400" cy="350" rx="72" ry="28" fill="#d4d4d8" opacity="0.55"/>
    <ellipse cx="510" cy="340" rx="88" ry="62" fill="#ecfccb" opacity="0.55"/>
    <path d="M470 300 L520 295 L540 330 L500 360 L455 345 L440 315 Z" fill="#d97706" opacity="0.85"/>
    <path d="M485 310 L515 305 L525 330 L495 345 L470 330 Z" fill="#92400e" opacity="0.45"/>
    <ellipse cx="330" cy="318" rx="34" ry="24" fill="#fef3c7" stroke="#fcd34d" stroke-width="2"/>
    <ellipse cx="330" cy="320" rx="22" ry="14" fill="#fde68a" opacity="0.85"/>
  `);
}

/** Africa/Caribbean — jollof rice with grilled chicken */
export function jollofRiceSvg() {
  return plateScene('Jollof rice with grilled chicken', `
    <ellipse cx="400" cy="345" rx="245" ry="88" fill="#ffffff" stroke="#e2e8f0" stroke-width="3"/>
    <ellipse cx="380" cy="350" rx="130" ry="58" fill="#ea580c" opacity="0.88"/>
    <ellipse cx="380" cy="355" rx="108" ry="42" fill="#c2410c" opacity="0.55"/>
    <path d="M500 295 L545 310 L535 350 L490 365 L465 335 Z" fill="#a16207" opacity="0.9"/>
    <path d="M510 305 L530 315 L522 345 L495 355 L485 325 Z" fill="#78350f" opacity="0.55"/>
    <ellipse cx="540" cy="340" rx="22" ry="14" fill="#854d0e" opacity="0.85" transform="rotate(-18 540 340)"/>
    <ellipse cx="555" cy="352" rx="18" ry="10" fill="#a16207" transform="rotate(12 555 352)"/>
  `);
}

/** @deprecated Use fishChipsSvg */
export function ukRoastDinnerSvg() {
  return fishChipsSvg();
}

/** @deprecated Use idliSambarSvg */
export function westernBowlSvg() {
  return idliSambarSvg();
}
