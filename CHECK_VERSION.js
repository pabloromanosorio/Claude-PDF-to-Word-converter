#!/usr/bin/env node
/**
 * Version checker - run this to see which code version you have
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 CODE VERSION CHECKER\n');
console.log('Current directory:', process.cwd());
console.log('This script location:', __dirname);

// Check for converter.js (OLD code)
const converterPath = path.join(__dirname, 'lib', 'converter.js');
if (fs.existsSync(converterPath)) {
  console.log('\n❌ OLD CODE DETECTED!');
  console.log('   Found: lib/converter.js (should NOT exist)');
  console.log('   You are running the CODE GENERATION version (broken)');
} else {
  console.log('\n✅ lib/converter.js not found (good!)');
}

// Check convertPdf.js for Skills API
const convertPdfPath = path.join(__dirname, 'lib', 'convertPdf.js');
if (fs.existsSync(convertPdfPath)) {
  const content = fs.readFileSync(convertPdfPath, 'utf8');

  if (content.includes('skills-2025-10-02')) {
    console.log('✅ Skills API code detected (CORRECT)');
    console.log('   lib/convertPdf.js uses Skills API');
  } else if (content.includes('converter.js') || content.includes('generateCode')) {
    console.log('❌ OLD CODE GENERATION detected in lib/convertPdf.js');
  } else {
    console.log('⚠️  Unknown version');
  }

  // Show first 20 lines
  console.log('\nFirst 20 lines of lib/convertPdf.js:');
  console.log('─'.repeat(60));
  const lines = content.split('\n').slice(0, 20);
  lines.forEach((line, i) => {
    console.log(`${String(i + 1).padStart(3)}: ${line}`);
  });
  console.log('─'.repeat(60));
} else {
  console.log('❌ lib/convertPdf.js not found!');
}

console.log('\n');
