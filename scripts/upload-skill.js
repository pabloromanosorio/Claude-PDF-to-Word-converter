const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

async function uploadSkill() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable not set');
    console.error('Usage: ANTHROPIC_API_KEY=your-key node scripts/upload-skill.js');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  try {
    // Read the zip file
    const zipPath = 'image-to-docx-converter.zip';
    if (!fs.existsSync(zipPath)) {
      console.error(`Error: Skill package not found at ${zipPath}`);
      process.exit(1);
    }

    const zipBuffer = fs.readFileSync(zipPath);
    const stats = fs.statSync(zipPath);

    console.log('Skill package ready:');
    console.log(`  Path: ${zipPath}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log('');

    // Note: The Skills API endpoint for uploading custom skills may not be publicly documented yet.
    // This script provides the infrastructure for uploading when the API becomes available.

    console.log('=== Manual Upload Instructions ===');
    console.log('');
    console.log('Since the Anthropic Skills API upload endpoint may not be publicly available,');
    console.log('please upload the skill manually:');
    console.log('');
    console.log('1. Go to: https://console.anthropic.com/skills');
    console.log('2. Click "Upload Skill" or "Create Custom Skill"');
    console.log('3. Upload the file: image-to-docx-converter.zip');
    console.log('4. Once uploaded, copy the generated skill_id');
    console.log('5. Add to your .env file:');
    console.log('   SKILL_ID=your-generated-skill-id');
    console.log('');
    console.log('=== API Integration (when available) ===');
    console.log('');
    console.log('When the Skills API upload endpoint is documented, you can use:');
    console.log('');
    console.log('const response = await client.skills.create({');
    console.log('  name: "image-to-docx-converter",');
    console.log('  description: "Convert document images to Word format",');
    console.log('  file: zipBuffer');
    console.log('});');
    console.log('');
    console.log('Then save the returned skill_id to .env');
    console.log('');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

uploadSkill();
