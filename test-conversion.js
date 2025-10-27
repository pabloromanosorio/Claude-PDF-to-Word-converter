require('dotenv').config();
const { convertWithSkills } = require('./src/skills-api-converter');
const path = require('path');

async function test() {
  console.log('Testing Skills API conversion...\n');

  // Test with a sample file (provide your own)
  const testFile = process.argv[2];

  if (!testFile) {
    console.error('Usage: node test-conversion.js <path-to-pdf-or-image>');
    process.exit(1);
  }

  const settings = {
    font: 'Arial',
    fontSize: 12,
    margins: {
      top: 1440,
      right: 1440,
      bottom: 1440,
      left: 1440
    },
    replaceSignatures: true,
    addPageMarkers: true,
    model: 'claude-sonnet-4-5-20250929'
  };

  const fileName = path.basename(testFile, path.extname(testFile));

  try {
    const result = await convertWithSkills(
      testFile,
      fileName,
      settings,
      (progress) => {
        console.log(`[${progress.status}] ${progress.progress}%`);
      }
    );

    console.log('\n✅ Success!');
    console.log('Output:', result.outputPath);
    console.log('Cost:', `$${result.cost.toFixed(4)}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

test();
