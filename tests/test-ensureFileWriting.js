#!/usr/bin/env node
// test-ensureFileWriting.js - Test that ensureFileWriting can handle truncated code

const { ensureFileWriting } = require('./lib/converter');

console.log('Testing ensureFileWriting with truncated code...\n');

// Simulate truncated code (missing closing braces and file writing)
const truncatedCode = `const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle, WidthType, ShadingType } = require('docx');
const fs = require('fs');

const doc = new Document({
  sections: [{
    properties: {
      page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } }
    },
    children: [
      new Paragraph({
        children: [new TextRun({ text: "Test content", font: "Arial", size: 20 })]
      })`;
// Note: code is truncated here - missing closing braces and file writing

console.log('Input (truncated code):');
console.log('─'.repeat(70));
console.log(truncatedCode);
console.log('─'.repeat(70));
console.log(`Code length: ${truncatedCode.length} characters`);
console.log(`Ends with: "${truncatedCode.slice(-20)}"`);
console.log('');

try {
  const outputPath = '/tmp/test-output.docx';
  const fixedCode = ensureFileWriting(truncatedCode, outputPath);

  console.log('✓ ensureFileWriting completed successfully!\n');

  console.log('Output (fixed code):');
  console.log('─'.repeat(70));
  console.log(fixedCode);
  console.log('─'.repeat(70));
  console.log(`Code length: ${fixedCode.length} characters`);
  console.log(`Ends with: "${fixedCode.slice(-100)}"`);
  console.log('');

  // Verify the fix
  const checks = {
    'Has writeFileSync': fixedCode.includes('writeFileSync'),
    'Has Packer.toBuffer': fixedCode.includes('Packer.toBuffer'),
    'Balanced braces': (fixedCode.match(/{/g) || []).length === (fixedCode.match(/}/g) || []).length,
    'Balanced brackets': (fixedCode.match(/\[/g) || []).length === (fixedCode.match(/\]/g) || []).length,
    'Balanced parens': (fixedCode.match(/\(/g) || []).length === (fixedCode.match(/\)/g) || []).length
  };

  console.log('Verification:');
  console.log('─'.repeat(70));
  let allPassed = true;
  for (const [check, passed] of Object.entries(checks)) {
    const symbol = passed ? '✓' : '✗';
    console.log(`  ${symbol} ${check}: ${passed ? 'YES' : 'NO'}`);
    if (!passed) allPassed = false;
  }
  console.log('');

  if (allPassed) {
    console.log('🎉 SUCCESS! The fix is working correctly.');
    console.log('   closeIncompleteStructure function is properly defined and working.');
    process.exit(0);
  } else {
    console.log('❌ FAILED: Some checks did not pass');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ ERROR:', error.message);
  console.error('');
  console.error('Stack trace:');
  console.error(error.stack);
  process.exit(1);
}
