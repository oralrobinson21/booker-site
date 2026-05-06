#!/usr/bin/env node
const fs=require('fs');
const code=fs.readFileSync('src/citytask.js','utf8');
const expected=['tasks','assignments','scheduleEntries','auditEvents'];
for(const token of expected){
  if(!code.includes(token)){console.error('Execution foundation missing token:',token);process.exit(1);} 
}
if(!code.includes('task_missing_dependencies') || !code.includes('service_inactive')){
  console.error('Task execution guardrails missing');
  process.exit(1);
}
console.log('Execution foundation verification passed.');
