// Input: vercel env ls --json saved privately. Never emits values.
// Encrypted values returned by listing APIs are ciphertext, NOT runtime bytes.
import {readFileSync} from 'node:fs';
const input=JSON.parse(readFileSync(process.argv[2],'utf8'));
const rows=(input.envs||[]).map(e=>({name:e.key,nameBytes:Buffer.byteLength(e.key),valueBytes:Buffer.byteLength(e.value||''),measurement:e.type==='plain'?'plaintext':'stored-representation-only'}));
console.log(JSON.stringify({warning:'Not an effective decrypted runtime total. Branch/shared overrides and system variables require provider resolution.',plaintextNameValueBytes:rows.filter(e=>e.measurement==='plaintext').reduce((n,e)=>n+e.nameBytes+e.valueBytes,0),variables:rows},null,2));
