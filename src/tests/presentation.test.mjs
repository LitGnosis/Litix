import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('presentation-only update retains recovered checkout and catalog source',()=>{
 const hash = path => createHash('sha256').update(read(path)).digest('hex');
 assert.equal(hash('app/page.jsx'),'699fe6dc9af068816be4ef184a7a24d63c4eb9d0efd4cc25b6dbd96c6a638344');
 assert.equal(hash('app/api/[action]/route.js'),'dc542d82a2e3e9df14130f667b0eb7521f0df7cbcee722144a9fa5d142ff2133');
});
test('theme is mounted globally and provides motion and keyboard accommodations',()=>{
 assert.match(read('app/layout.jsx'),/import "\.\/metallic\.css"/);
 const css=read('app/metallic.css');
 for(const pattern of [/prefers-reduced-motion:reduce/,/focus-visible/,/--gold:#ffe071/,/--blue:#2885ff/,/@keyframes platinum-flow/]) assert.match(css,pattern);
});
