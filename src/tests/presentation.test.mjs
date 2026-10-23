import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('theme is mounted globally and provides motion and keyboard accommodations',()=>{
 assert.match(read('app/layout.jsx'),/import "\.\/metallic\.css"/);
 const css=read('app/metallic.css');
 for(const pattern of [/prefers-reduced-motion:reduce/,/focus-visible/,/--gold:#ffe071/,/--blue:#2885ff/,/@keyframes platinum-flow/]) assert.match(css,pattern);
});

test('premium checkout uses gateway-hosted tokenized card fields',()=> {
 const component=read('components/PremiumInlineCheckout.jsx');
 for(const selector of ['id="ccnumber"','id="ccdate"','id="ccsecurity"','type="submit"']) assert.ok(component.includes(selector));
 assert.doesNotMatch(component,/name="(?:cardNumber|cvc|expiry)"/);
 const page=read('app/page.jsx');
 assert.match(page,/import PremiumInlineCheckout from "\.\.\/components\/PremiumInlineCheckout"/);
 assert.match(page,/paymentToken:token/);
});
