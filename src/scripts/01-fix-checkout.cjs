const fs = require('node:fs');
const p = 'app/page.jsx';
let s = fs.readFileSync(p, 'utf8');
if (s.includes('script#litix-paykings-collect') && !s.includes('data-litix-paykings-collect')) {
  console.log('Collect.js repair already present');
} else {
  if (!s.includes('script.setAttribute("data-litix-paykings-collect","true")')) {
    throw Error('Checkout source differs: refusing to modify payment code');
  }
  s = s.replace('script.setAttribute("data-litix-paykings-collect","true");', 'script.id="litix-paykings-collect";')
    .replaceAll('script[data-litix-paykings-collect="true"]', 'script#litix-paykings-collect')
    .replaceAll('loadedScript.dataset.litixLoaded', 'loadedScript.__litixLoaded')
    .replaceAll('script.dataset.litixLoaded', 'script.__litixLoaded')
    .replaceAll('script.dataset.litixFailed', 'script.__litixFailed')
    .replaceAll('script?.dataset.litixFailed', 'script?.__litixFailed');
  if (s.includes('data-litix-paykings-collect')) throw Error('Collect.js fix incomplete');
  fs.writeFileSync(p, s);
  console.log('Safe Collect.js repair included');
}
