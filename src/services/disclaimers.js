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
};

export function disclaimerBlock(text, className = 'fine-print health-disclaimer') {
  return `<p class="${className}">${text}</p>`;
}
