const fs=require('fs');
const logPath='C:/Users/user/Projects/nutrilog-deploy/src/views/log.js';
const uiPath='C:/Users/user/Projects/nutrilog-deploy/src/services/analyze-scan-ui.js';
let log=fs.readFileSync(logPath,'utf8');
let ui=fs.readFileSync(uiPath,'utf8');
if(!log.includes('function isDrinkLog')){log=log.replace('    photoLogKind: null,\n  };','    photoLogKind: null,\n  };\n\n  function isDrinkLog() {\n    return state.photoLogKind === \'drink\';\n  }\n\n  function setPhotoLogKind(kind) {\n    state.photoLogKind = kind === \'drink\' ? \'drink\' : \'food\';\n    state.source = isDrinkLog() ? \'drink\' : \'meal\';\n  }\n\n  function clearPhotoLogKind() {\n    state.photoLogKind = null;\n    state.source = null;\n  }');}
const reps=[
['if (state.source === \'drink\') {\n      return buildDrinkAnalysisNotes','if (isDrinkLog()) {\n      return buildDrinkAnalysisNotes'],
['function prepareMealPhotoFlow() {\n    state.source = \'meal\';','function prepareMealPhotoFlow() {\n    setPhotoLogKind(\'food\');'],
['function prepareDrinkPhotoFlow() {\n    state.source = \'drink\';','function prepareDrinkPhotoFlow() {\n    setPhotoLogKind(\'drink\');'],
['return openLiveCameraCore();\n  }\n\n  async function openDrinkLiveCamera() {\n    prepareDrinkPhotoFlow();\n    return openLiveCameraCore();','return openLiveCameraCore(\'food\');\n  }\n\n  async function openDrinkLiveCamera() {\n    prepareDrinkPhotoFlow();\n    return openLiveCameraCore(\'drink\');'],
['async function openLiveCameraCore() {','async function openLiveCameraCore(logKind) {'],
['return openCameraCore();\n  }\n\n  async function openDrinkCamera() {\n    prepareDrinkPhotoFlow();\n    return openCameraCore();','return openCameraCore(\'food\');\n\n  async function openDrinkCamera() {\n    prepareDrinkPhotoFlow();\n    return openCameraCore(\'drink\');'],
['async function openCameraCore() {','async function openCameraCore(logKind) {'],
['return openGalleryCore();\n  }\n\n  async function openDrinkGallery() {\n    prepareDrinkPhotoFlow();\n    return openGalleryCore();','return openGalleryCore(\'food\');\n\n  async function openDrinkGallery() {\n    prepareDrinkPhotoFlow();\n    return openGalleryCore(\'drink\');'],
['async function openGalleryCore() {','async function openGalleryCore(logKind) {'],
['return onPhotoSelectedCore(e);\n  }\n\n  async function onDrinkPhotoSelected(e) {\n    prepareDrinkPhotoFlow();\n    return onPhotoSelectedCore(e);','return onPhotoSelectedCore(e, \'food\');\n\n  async function onDrinkPhotoSelected(e) {\n    prepareDrinkPhotoFlow();\n    return onPhotoSelectedCore(e, \'drink\');'],
['async function onPhotoSelectedCore(e) {','async function onPhotoSelectedCore(e, logKind) {\n    setPhotoLogKind(logKind);'],
['await useImage(compressed);','await useImage(compressed, logKind);'],
['async function useImage(image) {','async function useImage(image, logKind = state.photoLogKind || \'food\') {'],
['    if (state.source === \'drink\') readDrinkNotesFromDom();\n    else readMealNotesFromDom();','    setPhotoLogKind(logKind);\n    if (isDrinkLog()) readDrinkNotesFromDom();\n    else readMealNotesFromDom();'],
['state.status = state.source === \'drink\' ? \'Analysing your drink…\' : \'Analysing your meal…\';','state.status = isDrinkLog() ? \'Analysing your drink…\' : \'Analysing your food…\';'],
['const isDrink = state.source === \'drink\';','const isDrink = isDrinkLog();'],
['        } : undefined);','        } : {\n          title: \'Analysing your food…\',\n          steps: PHOTO_ANALYSIS_STEPS,\n          photoAlt: \'Your food photo\',\n        });'],
['analyzeStatusCleanup = startPhotoScanStatusCycle(root);','const steps = isDrink ? DRINK_ANALYSIS_STEPS : PHOTO_ANALYSIS_STEPS;\n      analyzeStatusCleanup = startPhotoScanStatusCycle(root, steps);'],
['Review your meal','Review your food'],
['connect AI for your actual meal','connect AI for your actual food'],
['\'Meal saved!\'','\'Food saved!\''],
['state.step = \'capture\';\n      persist();\n      render();\n      return;\n    }\n\n    state.analysis = result.analysis;','state.step = \'capture\';\n      clearPhotoLogKind();\n      persist();\n      render();\n      return;\n    }\n\n    state.analysis = result.analysis;'],
['root.querySelector(\'#backCapture\').addEventListener(\'click\', () => { state.step = \'capture\'; render(); });','root.querySelector(\'#backCapture\').addEventListener(\'click\', () => {\n      state.step = \'capture\';\n      clearPhotoLogKind();\n      render();\n    });'],
['  startPhotoScanStatusCycle,\n  DRINK_ANALYSIS_STEPS,','  startPhotoScanStatusCycle,\n  PHOTO_ANALYSIS_STEPS,\n  DRINK_ANALYSIS_STEPS,'],
];
for (const [a,b] of reps){ if(log.includes(a)) log=log.replace(a,b); else console.log('missing', JSON.stringify(a.slice(0,50))); }
log=log.split("if (state.source === 'drink')").join('if (isDrinkLog())');
log=log.split("state.source === 'drink'").join('isDrinkLog()');
log=log.split('if (img) await useImage(img);').join('if (img) await useImage(img, logKind);');
log=log.split('if (native) await useImage(native);').join('if (native) await useImage(native, logKind);');
ui=ui.replace("title = 'Analysing your meal'", "title = 'Analysing your food'").replace("photoAlt = 'Your meal photo'", "photoAlt = 'Your food photo'");
fs.writeFileSync(logPath,log); fs.writeFileSync(uiPath,ui); console.log('done');
