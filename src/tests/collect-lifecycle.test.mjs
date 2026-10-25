import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the actual effect, with gateway/network/React replaced. No payments.
const page = readFileSync(new URL('../app/page.jsx', import.meta.url), 'utf8');
const start=page.indexOf('  let active=true;');
const end=page.indexOf(' },[config.',start);
const effect=page.slice(start,end);

function harness() {
 const scripts=[], timers=new Map(); let next=0, ready=false, notice='', options;const polls=new Map();
 const window={setInterval:fn=>{polls.set(++next,fn);return next},clearInterval:id=>polls.delete(id),setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)};
 const document={
  getElementById:()=>({getClientRects:()=>[{}]}),
  querySelectorAll:()=>scripts.filter(s=>s.isConnected),
  querySelector:()=>scripts.find(s=>s.isConnected)||null,
  createElement:()=>({dataset:{},listeners:{},isConnected:false,
   setAttribute(k,v){this.dataset[k.replace(/^data-/, '').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;},
   addEventListener(k,fn){this.listeners[k]=fn;},removeEventListener(k,fn){if(this.listeners[k]===fn)delete this.listeners[k];},
   remove(){this.isConnected=false;}}),
  head:{appendChild(s){s.isConnected=true;scripts.push(s);}}
 };
 const context={getComputedStyle:()=>({visibility:"visible"}),window,document,getCollectJS:()=>window.CollectJS,config:{ready:true,publicKey:'test-public-tokenization-key'},setCardReady:v=>ready=v,setNotice:v=>notice=v,setBusy:()=>{},done:{current:()=>{}}};
 return {window,scripts,timers,get ready(){return ready;},get notice(){return notice;},get options(){return options;},
  run(){return vm.runInNewContext('(function(){'+effect+'})()',context);},
  load(){window.CollectJS={configure:o=>options=o};scripts.at(-1).listeners.load();for(const fn of [...polls.values()])fn();},
  timeout(){const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());}
 };
}
test('script download stall fails visibly and retry replaces stalled script',()=>{
 const h=harness(); const cleanup=h.run(); const original=h.scripts[0];
 h.timeout(); assert.equal(h.ready,false); assert.match(h.notice,/did not finish loading/);
 cleanup(); h.run(); assert.equal(original.isConnected,false); assert.equal(h.scripts.length,2);
 h.load(); h.options.fieldsAvailableCallback(); assert.equal(h.ready,true); assert.equal(h.timers.size,0);
});
test('script error can be retried without deleting the gateway global',()=>{
 const h=harness(); const cleanup=h.run(); h.scripts[0].listeners.error();
 assert.match(h.notice,/could not load/); cleanup();h.run();h.load();h.options.fieldsAvailableCallback();assert.equal(h.ready,true);
});
test('late frames recover after readiness deadline, with explicit inline targets',()=>{
 const h=harness();h.run();h.load();h.timeout();assert.equal(h.ready,false);
 h.options.fieldsAvailableCallback();assert.equal(h.ready,true);assert.equal(h.notice,'');
 assert.equal(h.options.variant,'inline');assert.equal(h.options.fields.ccexp.selector,'#ccexp');
 assert.equal(h.options.customCss['font-size'],'16px');
});
test('cleanup ignores obsolete callbacks and reuses already loaded gateway',()=>{
 const h=harness();const cleanup=h.run();h.load();const old=h.options;cleanup();
 old.fieldsAvailableCallback();assert.equal(h.ready,false);h.run();h.options.fieldsAvailableCallback();
 assert.equal(h.ready,true);assert.equal(h.scripts.length,1);
});
