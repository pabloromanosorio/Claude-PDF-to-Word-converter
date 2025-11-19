#!/usr/bin/env node
/**
 * Test actual Files API upload
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { toFile } = require('@anthropic-ai/sdk');
const fs = require('fs');

console.log('\n🧪 TESTING ACTUAL FILES API UPLOAD\n');

async function test() {
  try {
    // Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.log('❌ ANTHROPIC_API_KEY not set');
      process.exit(1);
    }
    console.log('✅ API key found');

    // Initialize client (EXACTLY like convertPdf.js does)
    const anthropic = new Anthropic({ apiKey });
    console.log('✅ Client initialized');
    console.log('   anthropic:', typeof anthropic);
    console.log('   anthropic.beta:', typeof anthropic.beta);
    console.log('   anthropic.beta.files:', typeof anthropic.beta.files);
    console.log('   anthropic.beta.files.upload:', typeof anthropic.beta.files.upload);

    if (!anthropic.beta || !anthropic.beta.files || !anthropic.beta.files.upload) {
      console.log('\n❌ ERROR: Beta Files API not available!');
      console.log('   This is the exact error you\'re seeing in the server.');
      console.log('\n   Possible causes:');
      console.log('   1. SDK version mismatch (node_modules has old version)');
      console.log('   2. Multiple node_modules directories');
      console.log('   3. Server is loading cached old SDK');
      process.exit(1);
    }

    // Create a test file
    const testContent = 'Test file for upload';
    fs.writeFileSync('/tmp/test-upload.txt', testContent);
    console.log('✅ Test file created');

    // Try actual upload (this will fail if API key is invalid, but that's a different error)
    console.log('\n📤 Attempting actual upload...');
    const fileUpload = await anthropic.beta.files.upload({
      file: await toFile(fs.createReadStream('/tmp/test-upload.txt'), 'test.txt', {
        type: 'text/plain'
      }),
      purpose: 'user_upload'
    }, {
      betas: ['files-api-2025-04-14']
    });

    console.log('✅ Upload successful!');
    console.log('   File ID:', fileUpload.id);
    console.log('\n✨ FILES API WORKS PERFECTLY!\n');

  } catch (error) {
    console.log('\n❌ ERROR:', error.message);

    if (error.message.includes('Cannot read properties of undefined')) {
      console.log('\n   This is the EXACT error from the server!');
      console.log('   The SDK is not properly initialized.');
      console.log('\n   Run these commands:');
      console.log('   rm -rf node_modules package-lock.json');
      console.log('   npm install');
      console.log('   npm list @anthropic-ai/sdk  # Should show 0.70.0');
    } else {
      console.log('\n   Stack:', error.stack);
    }
    process.exit(1);
  }
}

test();
