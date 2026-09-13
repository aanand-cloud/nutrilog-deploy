/** Shared wellness / nutrition disclaimers — keep wording consistent app-wide. */

export const DISCLAIMERS = {
  appFooter:
    'NutriLog provides AI and database estimates only — not medical or dietary advice. Check food labels when accuracy matters. Speak to your GP or a registered dietitian for health concerns.',

  nutritionEstimate:
    'Estimates only — not medical advice. Check food labels or packaging when accuracy matters.',

  aiPhoto:
    'AI estimates portions and nutrition — not laboratory analysis. Check labels when accuracy matters.',

  packagedFood:
    'Product database values may differ from your pack — check the label if unsure.',

  wellnessTargets:
    'Wellness estimates only — not medical advice. Adjust for your needs or consult a health professional.',

  aiCoach:
    'General wellness suggestions only — not personalised medical or dietary advice.',

  goalInsights:
    'Insights compare your logged estimates to targets you set — not a clinical assessment.',

  adaptiveTdee:
    '14-day TDEE is a wellness estimate from logged intake and scale weight — not a clinical metabolic test.',

  healthSync:
    'Health export/import is for your own records. MealNova cannot write Apple Health or Health Connect from the web app unless a native plugin is installed.',
};

export function disclaimerBlock(text, className = 'fine-print health-disclaimer') {
  return `<p class="${className}">${text}</p>`;
}
