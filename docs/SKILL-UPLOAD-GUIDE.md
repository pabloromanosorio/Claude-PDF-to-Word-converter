# Skill Upload Guide

This guide explains how to upload the `image-to-docx-converter` skill to Anthropic's Skills API.

## Prerequisites

1. **Anthropic API Key**: Get yours at https://console.anthropic.com/settings/keys
2. **Skill Package**: Already packaged at `image-to-docx-converter.zip` (6KB)

## Upload Methods

### Method 1: Manual Upload via Console (Recommended)

**Step 1: Navigate to Skills Console**
- Go to: https://console.anthropic.com/skills
- Sign in with your Anthropic account

**Step 2: Upload Skill Package**
- Look for "Upload Skill", "Create Custom Skill", or similar button
- Click to start upload process
- Select the file: `image-to-docx-converter.zip` (located in project root)

**Step 3: Configure Skill (if prompted)**
- Name: `image-to-docx-converter`
- Description: `Convert document images (PDF, JPG, PNG) to editable Word documents with professional formatting`
- Version: `1.0.0`

**Step 4: Get Skill ID**
- After upload completes, copy the generated `skill_id`
- It should look like: `skill_xxx...` or similar format

**Step 5: Configure Environment**
- Copy `.env.template` to `.env`:
  ```bash
  cp .env.template .env
  ```
- Edit `.env` and add your values:
  ```
  ANTHROPIC_API_KEY=sk-ant-your-actual-key
  SKILL_ID=your-generated-skill-id
  ```

**Step 6: Verify Configuration**
```bash
# Check that .env exists and is not tracked by git
ls -la .env
git status  # Should NOT show .env

# The .env file is already in .gitignore for security
```

---

### Method 2: Automated Upload via Script (When API Available)

Once the Skills API upload endpoint is publicly documented, use:

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-your-key

# Run upload script
node scripts/upload-skill.js
```

The script will:
1. Verify the skill package exists
2. Show package details (size, path)
3. Provide manual upload instructions (current behavior)
4. In the future: Automatically upload via API when endpoint is available

---

## Skill Package Contents

The `image-to-docx-converter.zip` includes:

```
skill.yaml           # Skill metadata and configuration
skill.md             # Skill documentation and instructions
examples/            # Example usage patterns
  - basic.json       # Simple conversion example
  - advanced.json    # Complex table and layout example
```

**Key Features:**
- Preserves document layout with 80-90% fidelity
- Auto-sizes table cells correctly
- Maintains alignment (left/center/right/justify)
- Creates editable Word documents (not images)
- Optimized for CAT tool compatibility
- Handles signatures (replace or keep as images)

---

## Verification

After setup, verify the configuration:

**1. Check environment variables:**
```bash
node -e "require('dotenv').config(); console.log('API Key:', process.env.ANTHROPIC_API_KEY ? 'Set ✓' : 'Missing ✗'); console.log('Skill ID:', process.env.SKILL_ID ? 'Set ✓' : 'Missing ✗');"
```

**2. Test skill access (when integrated):**
```javascript
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// This will be possible once skill is uploaded
const response = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  betas: ['skills-2025-10-02'],
  container: {
    skills: [{
      type: 'custom',
      skill_id: process.env.SKILL_ID,
      version: 'latest'
    }]
  },
  messages: [{ role: 'user', content: 'Test skill access' }]
});
```

---

## Troubleshooting

### Issue: "Skill not found" error

**Solution:**
- Verify `SKILL_ID` in `.env` matches the uploaded skill
- Check skill is active in Anthropic console
- Ensure you're using the correct API key (same account that uploaded skill)

### Issue: "API key invalid"

**Solution:**
- Verify API key starts with `sk-ant-`
- Check for extra spaces or newlines in `.env`
- Regenerate API key if needed at https://console.anthropic.com/settings/keys

### Issue: "Skills API not available"

**Solution:**
- Skills API is currently in limited beta
- Request access at Anthropic console
- Check if your account has beta features enabled

---

## Security Notes

**IMPORTANT:**
- Never commit `.env` to git (already in `.gitignore`)
- Never share your API key publicly
- API keys grant access to your Anthropic account
- Rotate keys regularly for security
- Use separate keys for development/production

**Key Storage:**
- Desktop app: Stores API key encrypted via `electron-store`
- Server: Use environment variables or secret management service
- CI/CD: Use encrypted secrets (GitHub Secrets, etc.)

---

## Cost Tracking

Each conversion using the skill costs approximately:

| Model | Input | Output | Typical Cost |
|-------|-------|--------|--------------|
| Claude Haiku 4.5 | $1.00/MTok | $5.00/MTok | $0.08-0.15 |
| Claude Sonnet 4.5 | $3.00/MTok | $15.00/MTok | $0.12-0.25 |

Factors affecting cost:
- Document complexity (tables, images, layout)
- Number of pages
- Image resolution
- Model selected (Haiku = cheaper, Sonnet = better quality)

---

## Next Steps

After uploading the skill:

1. **Proceed to Task 2**: Install dependencies
   ```bash
   npm install form-data dotenv --save
   ```

2. **Integrate Skills API**: Implement `src/skills-api-converter.js`

3. **Test conversion**: Use test script to verify end-to-end flow

4. **Build desktop app**: Create installers for Windows/Mac

---

## Support

If you encounter issues:

1. Check Anthropic Status: https://status.anthropic.com
2. Review API Docs: https://docs.anthropic.com
3. Contact Support: support@anthropic.com
4. GitHub Issues: [your-repo-url]

---

## Skill Updates

To update the skill in the future:

1. Modify skill files locally
2. Re-package: `cd skill && zip -r ../image-to-docx-converter.zip .`
3. Upload new version via console
4. Update `SKILL_ID` if changed (usually same ID, new version)
5. Test thoroughly before production use
