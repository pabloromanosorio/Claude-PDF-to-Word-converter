# Image-to-Word Converter Redesign with Skills API

**Date:** October 26, 2025
**Status:** Design Approved
**Author:** Claude Code with Pablo Roman

## Executive Summary

Redesign of the PDF-to-Word converter application to leverage Anthropic's Skills API, focusing on delivering professional, client-ready Word documents optimized for translation workflows.

**Key Change:** From prompt-based code generation to Skills API with custom `image-to-docx-converter` skill.

## Background

### Current System
- Electron desktop app
- Claude API generates docx.js code based on long prompts (~400 lines)
- Code executes to create Word documents
- Issues: "no code blocks" errors, prompt reliability, complex setup

### User Context
- **Role:** Translator
- **Input:** Document images (PDF, JPG, PNG) from clients
- **Primary workflow:** Convert → translate in CAT tool → deliver Word file
- **Key requirement:** Professional, client-ready output with minimal cleanup

## Design Goals

1. **Professional Output:** Delivery-ready Word documents (80-90% visual fidelity)
2. **Zero Technical Barrier:** Non-technical users on Windows/Mac can install and use without any command line or technical knowledge
3. **Simple Setup:** One-time API key entry with guided walkthrough
4. **Modern, Appealing UI:** Professional, intuitive interface that looks polished and modern
5. **Reliability:** Eliminate "no code blocks" errors
6. **Editability:** Clients can adjust margins/formatting easily
7. **CAT Tool Compatibility:** Clean paragraph segmentation, proper formatting metadata

## Architecture Decision

### Chosen Approach: Skill-Enhanced Conversion

**Why this approach:**
- Current docx.js code generation works well when it works
- Skills provide better pattern enforcement than long prompts
- Token-efficient (skill loads once per conversation)
- Easy to iterate (upload new skill versions)
- Full control over conversion logic

**Rejected alternatives:**
- Native processing with AI assists (too complex, large development effort)
- Two-phase AI pipeline (2x API calls, unnecessary complexity)
- Enhanced prompting without Skills (less reliable, more tokens)

## Technical Design

### 1. Custom Skill: `image-to-docx-converter`

**Purpose:** Enforce professional document creation patterns for translation workflows

**Structure:**
```
image-to-docx-converter/
├── SKILL.md                          # Core conversion principles
└── references/
    └── docx-js-patterns.md          # Code templates and examples
```

**SKILL.md Contents:**
- Core principles (professional quality, layout fidelity, editability)
- Layout decision framework (paragraphs vs invisible tables)
- Formatting standards (alignment, font sizes, spacing)
- Implementation workflow (5 steps)
- User settings integration
- Quality verification checklist

**Key Patterns Encoded:**
1. **No heading interpretation** - Reproduce exact font sizes
2. **Invisible tables for spatial layouts** - Side-by-side text (signatures, date blocks)
3. **All text black** - CAT tool compatibility
4. **Table auto-sizing** - Cells adjust to content, professional appearance
5. **Alignment preservation** - Critical for professional output

### 2. Application Architecture

**Components:**

**Enhanced Electron UI:**

**Modern Design Principles:**
- Clean, minimal interface with subtle gradients
- Card-based layout with shadows and rounded corners
- Smooth animations and transitions
- Professional color scheme (blues/purples for trust, white/light grays for cleanliness)
- Large, touch-friendly buttons
- Clear visual hierarchy
- Responsive to window resizing

**Main Window Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  Image to Word Converter                    [- □ ×]         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │         📄  Drag & Drop Files Here                   │   │
│  │                                                       │   │
│  │         or click to browse                           │   │
│  │                                                       │   │
│  │    Supports: PDF, JPG, PNG                           │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ⚙️ Settings                                                 │
│  ┌───────────────────┬───────────────────┬──────────────┐   │
│  │ Font: Arial ▼     │ Size: 12pt ▼      │ Quality: ⭐⭐⭐│   │
│  └───────────────────┴───────────────────┴──────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ☐ Replace signatures    ☐ Add page markers          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  Recent Conversions:                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✓ document1.docx    Today, 2:30 PM    $0.15         │   │
│  │ ✓ contract.docx     Today, 1:15 PM    $0.22         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│              [   Convert   ]              Total: $12.45      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**First-Run Experience:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Welcome! 👋                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Convert document images to professional Word files          │
│  in seconds, powered by Claude AI.                           │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Step 1: Get your free API key                       │   │
│  │                                                       │   │
│  │  [  Get API Key from Anthropic  ]                    │   │
│  │  (Opens in your browser)                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Step 2: Paste your API key here                     │   │
│  │                                                       │   │
│  │  [________________________________]  [Save]           │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  🔒 Your API key is stored securely and never shared.        │
│                                                               │
│                        [Skip for now]                        │
└─────────────────────────────────────────────────────────────┘
```

**Settings Panel (Expandable):**

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ Conversion Settings                                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Typography                                                   │
│  ┌──────────────────┬──────────────────┐                    │
│  │ Font             │ Size             │                    │
│  │ Arial        ▼   │ 12pt         ▼   │                    │
│  └──────────────────┴──────────────────┘                    │
│                                                               │
│  Margins (inches)                                            │
│  ┌─────┬─────┬─────┬─────┐                                  │
│  │ Top │Right│Btm  │Left │                                  │
│  │ 1.0 │ 1.0 │ 1.0 │ 1.0 │                                  │
│  └─────┴─────┴─────┴─────┘                                  │
│                                                               │
│  Special Options                                             │
│  ☑ Replace signatures with [Signature]                      │
│  ☑ Add page markers for translation                         │
│  ☐ Skip headers and footers                                 │
│                                                               │
│  Model                                                       │
│  ○ Haiku (Fast, $0.10-0.15/doc)                             │
│  ● Sonnet (Best quality, $0.15-0.25/doc)                    │
│                                                               │
│  Page Selection (PDF only)                                   │
│  ○ All pages                                                 │
│  ○ Specific pages: [1-5, 7, 9-12]                           │
│                                                               │
│              [Cancel]  [Apply]                               │
└─────────────────────────────────────────────────────────────┘
```

**Progress View:**

```
┌─────────────────────────────────────────────────────────────┐
│  Converting document.pdf...                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [████████████████████░░░░░░░░] 80%                         │
│                                                               │
│  ✓ File uploaded                                             │
│  ✓ Analyzing layout                                          │
│  ⟳ Generating Word document...                              │
│  ○ Finalizing                                                │
│                                                               │
│  Estimated cost: $0.18                                       │
│                                                               │
│                     [Cancel]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Success View:**

```
┌─────────────────────────────────────────────────────────────┐
│  ✅ Conversion Complete!                                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  document.docx                                               │
│                                                               │
│  [  Open Document  ]  [  Show in Folder  ]                  │
│                                                               │
│  Quality: ⭐⭐⭐⭐⭐                                           │
│  Cost: $0.18                                                 │
│  Time: 12 seconds                                            │
│                                                               │
│              [  Convert Another  ]                           │
└─────────────────────────────────────────────────────────────┘
```

**UI Components:**
- Drag-drop zone with visual feedback (border highlights on hover)
- Settings panel with collapsible sections
- Real-time progress display with smooth animations
- Cost tracking with running totals
- Recent conversions history
- Quality rating display
- Clear error messages with actionable solutions

**Conversion Engine** (updated):
```javascript
const response = await client.messages.create({
  model: settings.model,
  max_tokens: 16000,
  betas: [
    "code-execution-2025-08-25",
    "skills-2025-10-02"
  ],
  tools: [{
    type: "code_execution_2025_08_25",
    name: "code_execution"
  }],
  container: {
    skills: [{
      type: "custom",
      skill_id: "[uploaded-skill-id]",
      version: "latest"
    }]
  },
  messages: [{
    role: "user",
    content: [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: getMediaType(file),
          data: fileBase64
        }
      },
      {
        type: "text",
        text: buildPrompt(userSettings)
      }
    ]
  }]
});
```

**File Handling:**
- Code execution tool generates .docx in sandbox
- Extract file ID from response
- Download via Files API
- Save to user's specified location

**Settings Storage:**
- electron-store for API key (encrypted)
- User preferences (font, margins, etc.)

### 3. Skill vs Prompt Division

**In Skill (structural patterns):**
- Layout decision rules
- Professional quality standards
- Table formatting requirements
- Editability requirements
- Code structure patterns

**In Prompt (user settings):**
- Font name and size
- Margins (top, right, bottom, left)
- Replace signatures: yes/no
- Add page markers: yes/no
- Custom overrides per conversion

### 4. Skill Updates & Iteration

**Combination Approach:**
- **SKILL.md:** Core conversion patterns (stable)
- **App UI:** Temporary overrides per conversion (flexible)
- **Skill versions:** Upload new versions with proven patterns
- **Users always get "latest":** No manual updates needed

**Update workflow:**
1. User encounters new document type
2. Add temporary rule via app UI
3. If pattern proves useful → update SKILL.md
4. Upload new skill version
5. All future conversions benefit

## Implementation Benefits

### Token Efficiency
- **Before:** ~400 line prompt sent every request (~3-4KB)
- **After:** ~100 tokens initially, skill loads when invoked (~2-3KB once)
- **Savings:** Moderate (skill still loads per conversion, but more efficiently)

### Reliability
- Skills enforce patterns better than prompts
- Code execution in secure sandbox
- No "no code blocks" errors (different mechanism)
- Retry logic easier to implement

### Maintainability
- Skill versioning via API
- Users automatically get latest
- Easier to test and iterate
- Patterns documented in one place

### User Experience
- Same familiar Electron interface
- One-time API key setup
- Drag, drop, convert
- Professional output immediately

## Installation & Distribution

### Windows Distribution

**Installer Format:** Single `.exe` installer using NSIS

**Build Process:**
```json
// electron-builder config
{
  "win": {
    "target": "nsis",
    "icon": "assets/icon.ico",
    "publisherName": "Your Name",
    "sign": false  // Optional: code signing for trusted install
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "Image to Word Converter"
  }
}
```

**User Experience:**
1. Download `ImageToWordConverter-Setup-1.0.0.exe` from website
2. Double-click installer
3. Click "Next" through simple wizard (choose install location)
4. Desktop shortcut and Start Menu entry created
5. Double-click icon to launch
6. First-run welcome screen appears

**No Command Line Required:** Everything via GUI clicks

### macOS Distribution

**Installer Formats:** Both `.dmg` and `.pkg`

**Build Process:**
```json
// electron-builder config
{
  "mac": {
    "category": "public.app-category.productivity",
    "icon": "assets/icon.icns",
    "target": ["dmg", "pkg"],
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist"
  },
  "dmg": {
    "contents": [
      {
        "x": 130,
        "y": 220
      },
      {
        "x": 410,
        "y": 220,
        "type": "link",
        "path": "/Applications"
      }
    ],
    "title": "Image to Word Converter",
    "backgroundColor": "#ffffff"
  }
}
```

**User Experience (DMG):**
1. Download `ImageToWordConverter-1.0.0.dmg`
2. Double-click DMG file
3. Drag app icon to Applications folder
4. Eject DMG
5. Open Applications, double-click app
6. First-run welcome screen appears

**User Experience (PKG):**
1. Download `ImageToWordConverter-1.0.0.pkg`
2. Double-click installer
3. Follow simple wizard
4. App installed to Applications automatically
5. Launch from Launchpad or Applications

**Handling "Unidentified Developer":**
- Provide clear instructions: System Preferences → Security & Privacy → "Open Anyway"
- Or pursue Apple Developer Program membership ($99/year) for code signing

**No Terminal Required:** Everything via Finder/GUI

### First-Run Experience

**Steps (Identical on Windows/Mac):**

1. **Welcome Screen** appears automatically
2. **"Get API Key"** button opens https://console.anthropic.com/settings/keys in default browser
3. User creates/copies API key
4. User pastes into app
5. **"Save"** button stores key (encrypted via electron-store)
6. **Success message**: "✅ Ready to convert! Drag a file to start."
7. Main interface appears

**Fallback:** "Skip for now" allows exploration without API key (shows error when attempting conversion)

### Distribution Website

**Simple Landing Page:**
- Hero: "Convert Document Images to Word in Seconds"
- 2-minute demo video (screen recording)
- Download buttons (Windows / macOS)
- Quick Start Guide (3 steps with screenshots)
- FAQ section
- Contact/Support info

**Download Page Features:**
- Automatic OS detection (shows correct download button)
- Clear file sizes and version numbers
- Changelog link
- System requirements (Windows 10+, macOS 10.13+)

### Update Mechanism

**Auto-Update (electron-updater):**
- App checks for updates on launch
- Notification: "New version available! Update now?"
- Downloads and installs in background
- User restarts app when convenient

**No manual reinstallation needed**

## Migration Path

### Phase 1: Skill Upload & Testing
1. Upload `image-to-docx-converter` skill to Anthropic Skills API
2. Test with sample documents (various layouts)
3. Verify output quality matches/exceeds current
4. Iterate skill if needed

### Phase 2: UI Redesign
1. Create modern UI mockups (Figma/design tool)
2. Implement new React components
3. Add animations and transitions
4. Implement first-run welcome flow
5. Test on both Windows and Mac

### Phase 3: App Integration
1. Update converter.js to use Skills API
2. Add beta headers and tools config
3. Implement Files API download
4. Integrate with new UI components
5. Test end-to-end conversion

### Phase 4: Installer & Distribution
1. Configure electron-builder for both platforms
2. Create app icons (Windows .ico, macOS .icns)
3. Build and test installers
4. Create landing page/download site
5. Record demo video

### Phase 5: Release
1. Final testing on clean Windows/Mac machines
2. Document known issues
3. Publish installers to download site
4. Announce release
5. Gather user feedback

## Success Criteria

1. ✅ **Output quality:** 80-90% visual resemblance, professional appearance
2. ✅ **Reliability:** Zero "no code blocks" errors over 100 conversions
3. ✅ **Setup simplicity:** Non-technical users complete setup in <5 minutes
4. ✅ **Editability:** Clients can adjust margins without breaking layout
5. ✅ **CAT compatibility:** Clean segmentation, proper formatting preservation
6. ✅ **Cost efficiency:** Similar or lower API costs vs current system

## Open Questions

1. **Skill ID management:** How to handle skill_id in app after upload?
   - **Answer:** Store in config, update when new version uploaded

2. **Page selection:** Keep existing pdf-lib page extraction?
   - **Answer:** Yes, extract pages before sending to API

3. **Prompt modes:** Keep simple/advanced/custom?
   - **Answer:** Skill handles patterns, modes become "detail level" in prompt

4. **Error handling:** What if skill fails to invoke?
   - **Answer:** Implement fallback to enhanced prompt-only mode

## Next Steps

1. ✅ Create and package skill
2. 🔄 Upload skill to Anthropic Skills API
3. ⏳ Test skill with sample documents
4. ⏳ Update converter.js with Skills API integration
5. ⏳ Update UI for any new features
6. ⏳ End-to-end testing
7. ⏳ Package and distribute new app version

## Appendices

### A. Skill Package Location
`/Users/pabloromanromanosorio/pdf-converter-app-clean/image-to-docx-converter.zip`

### B. Key Files Modified
- `converter.js` - Main conversion logic
- `package.json` - May need Files API dependencies
- Settings UI - Potentially simplified

### C. References
- Anthropic Skills API: https://docs.claude.com/en/api/skills-guide
- docx-js documentation: https://docx.js.org/
- Skills repository: https://github.com/anthropics/skills
