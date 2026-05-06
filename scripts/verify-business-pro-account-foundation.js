#!/usr/bin/env node
const fs=require('fs');
const files=['signup.html','login.html','dashboard.html','src/citytask.js'];
const missing=files.filter(f=>!fs.existsSync(f));
if(missing.length){console.error('Missing required files:',missing);process.exit(1);} 
const code=fs.readFileSync('src/citytask.js','utf8');
for(const required of ['signup(','login(','createBusiness(','upsertProProfile(','dashboardData(']){
  if(!code.includes(required)){console.error('Missing account foundation contract:',required);process.exit(1);} 
}
if(!code.includes('providerDefaults')){console.error('Provider gates missing');process.exit(1);} 
console.log('Account foundation verification passed.');
