# Testing Guide

## Integration Test Script

The `test-conversion.js` script allows you to test the Skills API conversion functionality end-to-end before running the full Electron app.

## Prerequisites

Before running the test, you need:

1. **Environment Variables**: Create a `.env` file in the project root with:
   ```
   ANTHROPIC_API_KEY=your-api-key-here
   SKILL_ID=your-skill-id-here
   ```

2. **Dependencies Installed**: Run `npm install` to ensure all dependencies are available

3. **Sample File**: Have a PDF, JPG, or PNG file ready for testing

## Running the Test

### Basic Usage

```bash
node test-conversion.js path/to/your/sample.pdf
```

### Examples

**Test with a PDF:**
```bash
node test-conversion.js ~/Documents/sample-document.pdf
```

**Test with an image:**
```bash
node test-conversion.js ~/Pictures/scanned-page.jpg
```

## What the Test Does

1. Loads your API key and skill ID from `.env`
2. Reads the specified file
3. Sends it to Claude via Skills API with the custom `image-to-docx-converter` skill
4. Tracks conversion progress through multiple stages:
   - Preparing (10%)
   - Analyzing (30%)
   - Generating (70%)
   - Creating document (85%)
   - Complete (100%)
5. Saves the output .docx file in the same directory as the input file
6. Reports the conversion cost

## Expected Output

```
Testing Skills API conversion...

[preparing] 10%
[analyzing] 30%
[generating] 70%
[creating document] 85%
[complete] 100%

✅ Success!
Output: /path/to/your/sample.docx
Cost: $0.1234
```

## Troubleshooting

### Error: "API key not configured"
- Ensure your `.env` file exists in the project root
- Verify `ANTHROPIC_API_KEY` is set correctly
- Check the API key starts with `sk-ant-`

### Error: "Skill ID not configured"
- Upload the skill package first using `scripts/upload-skill.js`
- Add the generated `SKILL_ID` to your `.env` file
- Or manually upload at https://console.anthropic.com/skills

### Error: "Module not found"
- Run `npm install` to install all dependencies
- Ensure you're in the project root directory

### Error: "No code generated"
- Check the API key has sufficient credits
- Verify the skill was uploaded successfully
- Try with a simpler document first

## Verifying Output Quality

After successful conversion:

1. Open the generated `.docx` file in Microsoft Word or LibreOffice
2. Check that:
   - Text is accurate and readable
   - Tables are present (if in original)
   - Layout resembles the original (80-90% fidelity)
   - Margins are editable
   - Formatting is preserved
   - Page markers are present (if multi-page)

## Next Steps

Once the test passes successfully:
1. Run the full Electron app with `npm start`
2. Test the UI workflow
3. Build the installer with `npm run build`
4. Test the installer on a clean machine
