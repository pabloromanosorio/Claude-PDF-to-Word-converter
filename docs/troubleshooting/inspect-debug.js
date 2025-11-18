#!/usr/bin/env node
// inspect-debug.js - View what's in your debug files

const fs = require('fs');
const path = require('path');

// Get directory from command line or use latest
let debugDir = process.argv[2];

if (!debugDir) {
  // Find most recent /tmp/conversion-* directory
  const tmpFiles = fs.readdirSync('/tmp');
  const conversionDirs = tmpFiles
    .filter(f => f.startsWith('conversion-'))
    .map(f => ({
      name: f,
      path: `/tmp/${f}`,
      mtime: fs.statSync(`/tmp/${f}`).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);
  
  if (conversionDirs.length === 0) {
    console.error('No debug directories found in /tmp/');
    console.error('Usage: node inspect-debug.js [path-to-debug-dir]');
    process.exit(1);
  }
  
  debugDir = conversionDirs[0].path;
  console.log(`Using most recent debug directory: ${debugDir}\n`);
}

if (!fs.existsSync(debugDir)) {
  console.error(`Directory not found: ${debugDir}`);
  process.exit(1);
}

console.log('═'.repeat(70));
console.log('DEBUG DIRECTORY INSPECTOR');
console.log('═'.repeat(70));
console.log(`Directory: ${debugDir}`);
console.log('');

// List all files
console.log('─'.repeat(70));
console.log('FILES:');
console.log('─'.repeat(70));
const files = fs.readdirSync(debugDir, { withFileTypes: true });
files.forEach(file => {
  if (file.isFile()) {
    const filePath = path.join(debugDir, file.name);
    const stats = fs.statSync(filePath);
    console.log(`  ${file.name} (${stats.size} bytes)`);
  }
});
console.log('');

// Show validation errors
const validationPath = path.join(debugDir, 'validation_errors.txt');
if (fs.existsSync(validationPath)) {
  console.log('─'.repeat(70));
  console.log('VALIDATION ERRORS:');
  console.log('─'.repeat(70));
  const errors = fs.readFileSync(validationPath, 'utf8');
  console.log(errors);
  console.log('');
}

// Show raw response (first 500 chars)
const rawPath = path.join(debugDir, 'raw.txt');
if (fs.existsSync(rawPath)) {
  console.log('─'.repeat(70));
  console.log('RAW API RESPONSE (first 500 chars):');
  console.log('─'.repeat(70));
  const raw = fs.readFileSync(rawPath, 'utf8');
  console.log(raw.substring(0, 500));
  if (raw.length > 500) {
    console.log(`... (${raw.length - 500} more characters)`);
  }
  console.log('');
}

// Show cleaned code (last 30 lines - most important)
const cleanedPath = path.join(debugDir, 'cleaned.js');
if (fs.existsSync(cleanedPath)) {
  console.log('─'.repeat(70));
  console.log('CLEANED CODE (last 30 lines):');
  console.log('─'.repeat(70));
  const cleaned = fs.readFileSync(cleanedPath, 'utf8');
  const lines = cleaned.split('\n');
  const startLine = Math.max(0, lines.length - 30);
  const lastLines = lines.slice(startLine).join('\n');
  console.log(lastLines);
  console.log('');
}

// Analysis
console.log('═'.repeat(70));
console.log('ANALYSIS:');
console.log('═'.repeat(70));

if (fs.existsSync(cleanedPath)) {
  const cleaned = fs.readFileSync(cleanedPath, 'utf8');
  
  const checks = {
    'Has docx import': cleaned.includes("require('docx')"),
    'Has fs import': cleaned.includes("require('fs')"),
    'Has Document': cleaned.includes('Document'),
    'Has Packer': cleaned.includes('Packer'),
    'Has Packer.toBuffer': cleaned.includes('Packer.toBuffer'),
    'Has writeFileSync': cleaned.includes('writeFileSync'),
    'Has markdown blocks': cleaned.includes('```'),
    'Starts with const': cleaned.trim().startsWith('const')
  };
  
  for (const [check, passed] of Object.entries(checks)) {
    const symbol = passed ? '✓' : '✗';
    const status = passed ? 'YES' : 'NO';
    console.log(`  ${symbol} ${check}: ${status}`);
  }
  
  console.log('');
  
  // Specific diagnosis
  if (!checks['Has writeFileSync']) {
    console.log('🔍 PROBLEM IDENTIFIED:');
    console.log('   The code is missing the file writing part (writeFileSync).');
    console.log('');
    console.log('💡 SOLUTION:');
    console.log('   Add the ensureFileWriting() function from QUICK_PATCH.md');
    console.log('   or use the complete code from FIX_WRITEFILESYNC_ERROR.md');
  } else if (!checks['Has Packer.toBuffer']) {
    console.log('🔍 PROBLEM IDENTIFIED:');
    console.log('   The code has writeFileSync but no Packer.toBuffer.');
    console.log('   This means it\'s trying to save without converting the document.');
    console.log('');
    console.log('💡 SOLUTION:');
    console.log('   The code structure is wrong. Use the improved prompt from');
    console.log('   FIX_WRITEFILESYNC_ERROR.md');
  } else if (checks['Has markdown blocks']) {
    console.log('🔍 PROBLEM IDENTIFIED:');
    console.log('   The code still has markdown blocks after cleaning.');
    console.log('');
    console.log('💡 SOLUTION:');
    console.log('   Improve the cleaning function to remove ``` markers more aggressively.');
  } else if (!checks['Starts with const']) {
    console.log('🔍 PROBLEM IDENTIFIED:');
    console.log('   The code doesn\'t start with "const" - there\'s extra text before it.');
    console.log('');
    console.log('💡 SOLUTION:');
    console.log('   The cleaning function needs to find the first "const" and cut before it.');
  } else {
    console.log('✓ Code looks good! All checks passed.');
    console.log('');
    console.log('  If conversion still failed, the problem might be:');
    console.log('  - Syntax error in the generated code');
    console.log('  - Missing dependency (docx library)');
    console.log('  - Runtime error during execution');
    console.log('');
    console.log('  Try running the cleaned code manually:');
    console.log(`  cd ${debugDir}`);
    console.log('  node cleaned.js');
  }
}

console.log('═'.repeat(70));
console.log('');
console.log('Full file paths:');
console.log(`  Raw response: ${path.join(debugDir, 'raw.txt')}`);
console.log(`  Cleaned code: ${path.join(debugDir, 'cleaned.js')}`);
if (fs.existsSync(validationPath)) {
  console.log(`  Validation errors: ${validationPath}`);
}
console.log('');
