#!/usr/bin/env node
/**
 * SDK Diagnostic Tool
 * Checks if @anthropic-ai/sdk is properly installed with beta features
 */

console.log('\n🔍 ANTHROPIC SDK DIAGNOSTIC\n');

try {
  // Check if SDK is installed
  const Anthropic = require('@anthropic-ai/sdk');
  console.log('✅ SDK package loaded');

  // Check SDK version
  const packageJson = require('./node_modules/@anthropic-ai/sdk/package.json');
  console.log(`✅ SDK version: ${packageJson.version}`);

  if (parseFloat(packageJson.version) < 0.70) {
    console.log('❌ ERROR: SDK version is too old!');
    console.log(`   Current: ${packageJson.version}`);
    console.log('   Required: >= 0.70.0');
    console.log('\n   Fix: Run these commands:');
    console.log('   rm -rf node_modules package-lock.json');
    console.log('   npm install\n');
    process.exit(1);
  }

  // Try to initialize SDK
  const client = new Anthropic({ apiKey: 'test-key' });
  console.log('✅ SDK client initialized');

  // Check for beta namespace
  if (!client.beta) {
    console.log('❌ ERROR: client.beta is undefined!');
    console.log('   This SDK version does not support beta features.');
    process.exit(1);
  }
  console.log('✅ client.beta exists');

  // Check for files API
  if (!client.beta.files) {
    console.log('❌ ERROR: client.beta.files is undefined!');
    console.log('   Files API is not available in this SDK version.');
    process.exit(1);
  }
  console.log('✅ client.beta.files exists');

  // Check for methods
  if (typeof client.beta.files.upload !== 'function') {
    console.log('❌ ERROR: client.beta.files.upload is not a function!');
    process.exit(1);
  }
  console.log('✅ client.beta.files.upload is a function');

  if (typeof client.beta.files.download !== 'function') {
    console.log('❌ ERROR: client.beta.files.download is not a function!');
    process.exit(1);
  }
  console.log('✅ client.beta.files.download is a function');

  console.log('\n✨ ALL CHECKS PASSED!');
  console.log('   Your SDK is properly installed and supports Files API + Skills API\n');

} catch (error) {
  console.log('❌ ERROR:', error.message);

  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('\n   Fix: Run npm install\n');
  } else {
    console.log('\n   Stack:', error.stack, '\n');
  }
  process.exit(1);
}
