#!/usr/bin/env node
/**
 * Test the conversion code path
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

console.log('\n🧪 TESTING CONVERSION CODE PATH\n');

// Test 1: Check environment
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.log('❌ ANTHROPIC_API_KEY not set in .env file');
  console.log('   Add ANTHROPIC_API_KEY=your-key-here to .env');
  process.exit(1);
}
console.log('✅ ANTHROPIC_API_KEY is set');

// Test 2: Initialize client (exactly like convertPdf.js does)
const anthropic = new Anthropic({ apiKey });
console.log('✅ Anthropic client initialized');

// Test 3: Check beta namespace
if (!anthropic.beta) {
  console.log('❌ anthropic.beta is undefined!');
  console.log('   SDK not properly initialized');
  process.exit(1);
}
console.log('✅ anthropic.beta exists');

// Test 4: Check files API
if (!anthropic.beta.files) {
  console.log('❌ anthropic.beta.files is undefined!');
  console.log('   This is the exact error you are seeing!');
  console.log('   The SDK client does not have beta.files');
  process.exit(1);
}
console.log('✅ anthropic.beta.files exists');

// Test 5: Check upload method
if (typeof anthropic.beta.files.upload !== 'function') {
  console.log('❌ anthropic.beta.files.upload is not a function!');
  process.exit(1);
}
console.log('✅ anthropic.beta.files.upload is a function');

console.log('\n✨ ALL TESTS PASSED!');
console.log('   The code should work. If you still get errors:');
console.log('   1. Make sure server is completely stopped');
console.log('   2. Delete node_modules and package-lock.json');
console.log('   3. Run npm install');
console.log('   4. Start server with: npm start\n');
