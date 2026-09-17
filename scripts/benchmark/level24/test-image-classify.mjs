import {
  classifyFood,
  mappingRank,
  titleCompatibleWithFood,
} from './image-classify.mjs';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('rejects flour idli prep photo', classifyFood('File:A flour for idly making.jpg') == null);
assert('rejects mexican dosa for classification', classifyFood('File:MexicanDosa FoodBites Mumbai.jpg') == null);
assert('chana biryani is vegetable not mutton family', classifyFood('File:Lunchbox Chana Biryani.jpg') === 'vegetable biryani');
assert('hydrabadi typo maps chicken', classifyFood('File:Hydrabadi Chicken Dum Biryani.jpg') === 'hyderabadi chicken biryani');
assert('thalappakatti without protein is family only', classifyFood('File:Dindigul Thalappakatti Biryani.jpg') === 'family:biryani');
assert('mutton incompatible with chicken title', !titleCompatibleWithFood('dindigul mutton biryani', 'File:Chicken Biryani.jpg'));
assert('mutton incompatible with chicken-biryani-plus-mutton-curry title', !titleCompatibleWithFood('dindigul mutton biryani', 'File:Chicken Biryani and Mutton Curry.jpg'));
assert('set dosa rejects wheat/aate dosa', !titleCompatibleWithFood('set dosa', 'File:Aate ka dosa.jpg'));
assert('chicken compatible with chicken title', titleCompatibleWithFood('dindigul chicken biryani', 'File:Chicken Biryani.jpg'));
assert('sambar idli rejects dosa platter title', !titleCompatibleWithFood('sambar idli', 'File:Idli Dosa with sambar.jpg'));
assert('plain idli rejects vada platter title', !titleCompatibleWithFood('plain idli', 'File:A plate of Idly and Vadai.JPG'));
assert('exact rank beats family', mappingRank('plain dosa', 'plain dosa', 'File:Plain Dosa.jpg') > mappingRank('plain dosa', 'family:biryani', 'File:Biryani.jpg'));
assert('incompatible rank is negative', mappingRank('dindigul mutton biryani', 'family:biryani', 'File:Chana Biryani.jpg') < 0);

console.log('Done.');
