/** Custom MealNova “How it works” step art — original SVG, no third-party photos. */

export function howStepSnapSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f8fffe"/>
      <stop offset="100%" stop-color="#ecfdf5"/>
    </linearGradient>
    <linearGradient id="plate" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f766e" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <ellipse cx="380" cy="310" rx="210" ry="88" fill="#e2e8f0" opacity="0.55"/>
  <g filter="url(#shadow)">
    <ellipse cx="380" cy="290" rx="190" ry="78" fill="url(#plate)" stroke="#cbd5e1" stroke-width="2"/>
    <circle cx="320" cy="270" r="34" fill="#fbbf24" opacity="0.95"/>
    <circle cx="380" cy="255" r="28" fill="#34d399"/>
    <circle cx="440" cy="275" r="30" fill="#f87171" opacity="0.9"/>
    <ellipse cx="365" cy="305" rx="70" ry="22" fill="#a78bfa" opacity="0.75"/>
    <ellipse cx="420" cy="298" rx="55" ry="18" fill="#fde68a" opacity="0.85"/>
  </g>
  <g transform="translate(490 130)">
    <rect x="0" y="0" width="210" height="360" rx="28" fill="#0f172a"/>
    <rect x="12" y="12" width="186" height="336" rx="20" fill="#ffffff"/>
    <rect x="28" y="36" width="154" height="200" rx="14" fill="#ecfdf5" stroke="#99f6e4" stroke-width="2"/>
    <circle cx="105" cy="136" r="42" fill="#14b8a6" opacity="0.18"/>
    <circle cx="105" cy="136" r="24" fill="#0d9488" opacity="0.35"/>
    <path d="M48 88h114v16H48zm0 96h114v16H48z" fill="#0f766e" opacity="0.25"/>
    <circle cx="168" cy="56" r="7" fill="#0f766e"/>
    <rect x="52" y="268" width="106" height="10" rx="5" fill="#e2e8f0"/>
    <rect x="72" y="292" width="66" height="10" rx="5" fill="#e2e8f0"/>
  </g>
  <g stroke="#0f766e" stroke-width="4" fill="none" opacity="0.7">
    <path d="M520 170h56v56h-56z"/>
    <path d="M528 178h12M548 178h12M528 198h12M548 198h12"/>
  </g>
</svg>`;
}

export function howStepEstimatesSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f0fdfa"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#0f766e" flood-opacity="0.14"/>
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#bg2)"/>
  <circle cx="400" cy="230" r="120" fill="#ecfdf5" stroke="#99f6e4" stroke-width="3"/>
  <path d="M400 130a100 100 0 0 1 86.6 50" fill="none" stroke="#34d399" stroke-width="18" stroke-linecap="round"/>
  <path d="M400 130a100 100 0 0 1 50 86.6" fill="none" stroke="#fbbf24" stroke-width="18" stroke-linecap="round"/>
  <path d="M400 130a100 100 0 0 1-14.6 99.5" fill="none" stroke="#f87171" stroke-width="18" stroke-linecap="round"/>
  <path d="M400 130a100 100 0 0 1-86.6 50" fill="none" stroke="#a78bfa" stroke-width="18" stroke-linecap="round"/>
  <circle cx="400" cy="230" r="52" fill="#fff" stroke="#e2e8f0" stroke-width="2"/>
  <text x="400" y="224" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="14">AI estimate</text>
  <text x="400" y="252" text-anchor="middle" fill="#0f766e" font-family="Arial, sans-serif" font-size="28" font-weight="700">548</text>
  <g filter="url(#cardShadow)">
    <rect x="170" y="360" width="460" height="170" rx="20" fill="#ffffff" stroke="#d1fae5" stroke-width="2"/>
    <text x="200" y="398" fill="#0f172a" font-family="Arial, sans-serif" font-size="22" font-weight="700">Salmon &amp; rice bowl</text>
    <text x="200" y="432" fill="#64748b" font-family="Arial, sans-serif" font-size="16">548 kcal · mixed plate</text>
    <rect x="200" y="452" width="72" height="34" rx="17" fill="#ecfdf5" stroke="#99f6e4"/>
    <text x="236" y="474" text-anchor="middle" fill="#0f766e" font-family="Arial, sans-serif" font-size="14" font-weight="700">P 42g</text>
    <rect x="282" y="452" width="72" height="34" rx="17" fill="#ecfdf5" stroke="#99f6e4"/>
    <text x="318" y="474" text-anchor="middle" fill="#0f766e" font-family="Arial, sans-serif" font-size="14" font-weight="700">C 48g</text>
    <rect x="364" y="452" width="72" height="34" rx="17" fill="#ecfdf5" stroke="#99f6e4"/>
    <text x="400" y="474" text-anchor="middle" fill="#0f766e" font-family="Arial, sans-serif" font-size="14" font-weight="700">F 16g</text>
    <rect x="456" y="452" width="88" height="34" rx="17" fill="#ccfbf1"/>
    <text x="500" y="474" text-anchor="middle" fill="#0f766e" font-family="Arial, sans-serif" font-size="12" font-weight="700">+ micros</text>
  </g>
</svg>`;
}

export function howStepTrackSvg() {
  const bars = [42, 58, 72, 78, 65, 54, 48];
  const barEls = bars.map((h, i) => {
    const x = 250 + i * 44;
    const bh = h * 1.1;
    return `<rect x="${x}" y="${360 - bh}" width="28" height="${bh}" rx="6" fill="url(#barFill)" opacity="0.9"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="bg3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f0fdfa"/>
    </linearGradient>
    <linearGradient id="barFill" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#0f766e"/>
      <stop offset="100%" stop-color="#14b8a6"/>
    </linearGradient>
    <filter id="panelShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f766e" flood-opacity="0.1"/>
    </filter>
  </defs>
  <rect width="800" height="600" fill="url(#bg3)"/>
  <g filter="url(#panelShadow)">
    <rect x="150" y="80" width="500" height="440" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  </g>
  <text x="400" y="118" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="1.2">TODAY</text>
  <circle cx="400" cy="230" r="88" fill="none" stroke="#e2e8f0" stroke-width="16"/>
  <circle cx="400" cy="230" r="88" fill="none" stroke="#14b8a6" stroke-width="16" stroke-linecap="round"
    stroke-dasharray="440 552" transform="rotate(-90 400 230)"/>
  <text x="400" y="224" text-anchor="middle" fill="#0f766e" font-family="Arial, sans-serif" font-size="34" font-weight="700">78%</text>
  <text x="400" y="252" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="14">of daily goal</text>
  <text x="400" y="330" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="13" font-weight="600">Weekly trend</text>
  ${barEls}
  <text x="400" y="430" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="12">Mon · Tue · Wed · Thu · Fri · Sat · Sun</text>
  <rect x="260" y="455" width="280" height="44" rx="12" fill="#ecfdf5" stroke="#99f6e4"/>
  <text x="400" y="483" text-anchor="middle" fill="#0f766e" font-family="Arial, sans-serif" font-size="14" font-weight="600">Reports · goals · progress</text>
</svg>`;
}
