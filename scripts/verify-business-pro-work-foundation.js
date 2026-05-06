#!/usr/bin/env node
const fs=require('fs');
const must=[
  'signup.html','login.html','dashboard.html','src/citytask.js'
];
const missing=must.filter(f=>!fs.existsSync(f));
if(missing.length){console.error('Missing required files:',missing);process.exit(1);}
const code=fs.readFileSync('src/citytask.js','utf8');
const checks=['businessStates','providerStatuses','checklistDefaults','createBusiness','upsertProProfile','createEntity'];
for(const c of checks){if(!code.includes(c)){console.error('Missing contract:',c);process.exit(1);}}
const banned=['ServiceTitan','master prompt','blueprint'];
const prodFiles=['dashboard.html','signup.html','login.html','src/citytask.js'];
for(const f of prodFiles){const t=fs.readFileSync(f,'utf8');for(const b of banned){if(t.includes(b)){console.error(`Banned copy ${b} in ${f}`);process.exit(1);}}}
console.log('Static verification passed.');
