# Testing Checklist

Run through this checklist before each release.

## Pre-Release Testing

### Installation
- [ ] Windows .exe installs successfully
- [ ] Mac .dmg/.app installs successfully
- [ ] Desktop shortcuts created
- [ ] App launches and browser opens
- [ ] No security warnings (or warnings are documented)

### First-Run Experience
- [ ] Welcome screen appears for new users
- [ ] API key setup screen is clear
- [ ] Link to Anthropic Console opens correctly
- [ ] Billing warning is visible
- [ ] API key validation works
- [ ] Skill upload completes successfully
- [ ] Transitions to main interface smoothly

### Conversion
- [ ] PDF single-page converts
- [ ] PDF multi-page converts
- [ ] JPG image converts
- [ ] PNG image converts
- [ ] Page selection works (e.g., "1-3, 5")
- [ ] Progress bar updates
- [ ] Download starts automatically
- [ ] Output file opens in Word
- [ ] Cost estimate is reasonable

### Output Quality
- [ ] Text is accurate (no hallucinations)
- [ ] Tables formatted correctly
- [ ] Layout matches original (80%+)
- [ ] Margins are editable in Word
- [ ] Page markers at sentence boundaries (if enabled)
- [ ] Signatures replaced correctly (if enabled)

### Settings
- [ ] Model selection works
- [ ] Font/size changes applied
- [ ] Margin adjustments work
- [ ] Checkboxes toggle correctly
- [ ] Settings persist after restart

### Error Handling
- [ ] Invalid API key → clear error message
- [ ] No billing → helpful message with link
- [ ] Network error → retry option
- [ ] File too large → size limit message
- [ ] Unsupported file type → format error

### Documentation
- [ ] README is accurate
- [ ] Download instructions work
- [ ] API key guide is clear
- [ ] Billing info is accurate
- [ ] Troubleshooting covers common issues

## User Testing

Get 2-3 non-technical users to:
- [ ] Install without help
- [ ] Set up API key
- [ ] Convert a document
- [ ] Report any confusion

Fix issues before public release.

## Performance
- [ ] Conversion completes in <60 seconds for typical document
- [ ] App starts in <5 seconds
- [ ] UI is responsive during conversion

## Security
- [ ] API key is encrypted in config.json
- [ ] No API keys in logs
- [ ] No documents stored permanently
- [ ] Temp files cleaned up after conversion
