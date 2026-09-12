/** Shared landing image filenames and dimensions. */
export const LANDING_IMAGES = [
  { base: 'hero-meal', file: 'hero-meal.jpg', width: 800, height: 600, position: 'centre' },
  { base: 'meal-india-idli', file: 'meal-india-idli.jpg', width: 800, height: 600, position: 'centre' },
  { base: 'meal-italy-pasta', file: 'meal-italy-pasta.jpg', width: 800, height: 600, position: 'south' },
  { base: 'meal-asia-thai-curry', file: 'meal-asia-thai-curry.jpg', width: 800, height: 600, position: 'centre' },
  { base: 'meal-middle-east-platter', file: 'meal-middle-east-platter.jpg', width: 800, height: 600, position: 'centre' },
  { base: 'meal-africa-jollof', file: 'meal-africa-jollof.jpg', width: 800, height: 600, position: 'centre' },
  { base: 'barcode-scan', file: 'barcode-scan.jpg', width: 800, height: 600, position: 'top' },
  { base: 'how-step-snap', file: 'how-step-snap.jpg', width: 800, height: 600, position: 'centre' },
  { base: 'how-step-estimates', file: 'how-step-estimates.jpg', width: 800, height: 600, position: 'centre' },
  { base: 'how-step-track', file: 'how-step-track.jpg', width: 800, height: 600, position: 'centre' },
  { base: 'demo-food-diary', file: 'demo-food-diary.jpg', width: 800, height: 600, position: 'centre' },
  { base: 'demo-reports', file: 'demo-reports.jpg', width: 800, height: 600, position: 'centre' },
];

export const LANDING_IMAGE_PATHS = Object.fromEntries(
  LANDING_IMAGES.map(({ base, file }) => [base, { jpg: `/images/${file}`, webp: `/images/${base}.webp` }]),
);
