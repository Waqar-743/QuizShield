// Fastn accepts the default workflow export; local named exports are test hooks.
const fs=require('fs');
const source=fs.readFileSync('fastn/quizshield-google.mjs','utf8');
fs.writeFileSync('fastn/quizshield-google.workflow.mjs',source.replace(/^export (?=(?:async )?function)/gm,''));
