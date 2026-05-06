#!/usr/bin/env node
const fs=require('fs');
const appFiles=['dashboard.html','src/citytask.js'];
const banned=['master prompt','blueprint','CityTask 75','CityTask 100','ServiceTitan'];
for(const file of appFiles){
  const text=fs.readFileSync(file,'utf8');
  for(const phrase of banned){
    if(text.includes(phrase)){console.error(`Banned planning artifact found in ${file}: ${phrase}`);process.exit(1);} 
  }
}
const requiredScripts=[
  'scripts/verify-business-pro-account-foundation.js',
  'scripts/verify-business-pro-work-foundation.js',
  'scripts/verify-business-pro-execution-foundation.js',
  'scripts/verify-business-pro-production-mvp.js'
];
const missing=requiredScripts.filter(p=>!fs.existsSync(p));
if(missing.length){console.error('Missing verifier scripts:',missing);process.exit(1);} 
console.log('Production MVP verification passed (static).');
