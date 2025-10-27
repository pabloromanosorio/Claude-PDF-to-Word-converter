---
name: image-to-docx-converter
description: This skill converts document images (PDF, JPG, PNG) to professional, delivery-ready Word documents optimized for translation workflows. Use when converting scanned documents, PDFs, or images that need to become editable Word files with high layout fidelity (80-90% visual resemblance), proper formatting, and CAT tool compatibility.
---

# Image to DOCX Converter

## Overview

This skill creates professional, client-ready Word documents from document images (PDFs, JPGs, PNGs). Designed for translation workflows where the output must be both visually faithful to the source and structurally clean for CAT tool processing.

**Primary Goal:** Delivery-ready professional Word output
**Quality Target:** 80-90% visual resemblance to source
**Key Requirement:** Fully editable, clean formatting, no artifacts

## Core Principles

### 1. Professional Document Quality

The output Word document must be immediately presentable to clients:

- **Clean structure**: Logical paragraph flow, consistent spacing
- **Professional appearance**: Polished layout, no formatting junk
- **Fully editable**: Standard styles, adjustable margins, no locked elements
- **No artifacts**: No invisible characters, weird spacing, or broken formatting

### 2. Visual Layout Fidelity (80-90%)

Prioritize semantic fidelity over pixel-perfect reproduction:

- **Text alignment**: Preserve left/right/center/justified (critical for professional look)
- **Spatial relationships**: Maintain side-by-side text positioning (signatures, name+date)
- **Font sizes**: Reproduce exactly as shown (do NOT interpret as "headings" or "titles")
- **Visual flow**: Document should feel like the original

**Important**: Exact syntactic layout is NOT required. Focus on readable, professional structure.

### 3. Translation Workflow Optimization

**For CAT tool compatibility:**
- Logical paragraph segmentation (each paragraph = translation segment)
- Clean formatting metadata (bold, italic, font, size preserved)
- Special characters preserved (accents, symbols)
- Page markers for translator reference

**For post-translation delivery:**
- Client can adjust margins, fonts without breaking layout
- Professional appearance maintained after translation
- Minimal formatting cleanup required

## Layout Decision Framework

Use this decision tree to determine how to structure content:

### When to Use Paragraphs

**Use for sequential text flow:**
- Body text, letters, essays
- Lists (bulleted or numbered)
- Text that reads top-to-bottom in linear order

### When to Use Invisible Tables

**Use for spatial layouts** (text positioned side-by-side horizontally):
- Signatures in a row (Name, Name, Name)
- Name on left, Date on right
- Side-by-side information blocks
- Any content where horizontal positioning matters

**Table Requirements:**
- Borders: `BorderStyle.NONE` (invisible)
- Width: Auto-adjust to page width or content-appropriate
- Cell widths: Auto-adjust to content (no manual resizing needed)
- Spacing: Proper padding inside cells
- **Must look professional immediately** - client should not need to fix table formatting

### When to Use Regular Tables

**Never** - This skill does not create data tables with visible borders. If source has data tables, convert to formatted paragraphs or use invisible tables with clear structure.

### Multi-Column Documents

For documents with columnar text (like newspapers):
- Process left column top-to-bottom FIRST
- Then right column below it as separate paragraphs
- Do NOT use tables for columnar text flow
- Exception: If columns have related content (like signature blocks), use invisible table

## Formatting Standards

### Text Reproduction

**Critical rules:**
1. **Exact font sizes**: Match source exactly (in half-points for docx-js)
2. **No heading interpretation**: Do NOT assume larger text is a "heading" or "title"
3. **All text black**: Use `color: "000000"` for CAT tool compatibility
4. **Preserve inline formatting**: Bold, italic, underline as shown

### Alignment Preservation

Alignment is critical for professional appearance:
- Left: `AlignmentType.LEFT`
- Center: `AlignmentType.CENTER`
- Right: `AlignmentType.RIGHT`
- Justified: `AlignmentType.JUSTIFIED`

Match the source document's alignment exactly.

### Spacing and Margins

- **Document margins**: Use settings provided by user (easily adjustable)
- **Paragraph spacing**: Appropriate before/after spacing for readability
- **Line spacing**: Default single spacing unless source indicates otherwise

## Special Handling

### Page Markers

Insert page markers for translator reference (if user settings request them):
- **Page 1**: No marker
- **Page 2+**: Insert `[Page X of the original]` at top of page
- Format as regular paragraph with spacing after
- Use actual PDF/image page position (not printed page numbers)

### Signature Handling

When user settings request signature replacement:
- Replace handwritten signature images or scanned signatures with text `[Signature]`
- Use regular TextRun: `new TextRun({ text: "[Signature]", color: "000000" })`
- Maintain original positioning (if signature was on right, keep right alignment)

## Implementation Workflow

### Step 1: Analyze Source Document

- Read the entire document image
- Identify layout patterns (sequential text vs spatial layouts)
- Note text alignment throughout
- Detect signature images (if replacement requested)
- Mark content to skip (headers/footers if requested)

### Step 2: Plan Document Structure

- Map content to paragraphs vs invisible tables
- Plan spacing and formatting
- Organize page breaks and page markers
- Note any special formatting (bold, italic, sizes)

### Step 3: Build with docx-js

Use the docx-js library to create the document:

**Required imports:**
```javascript
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, BorderStyle, UnderlineType, PageBreak } = require('docx');
```

**Document template:**
```javascript
const doc = new Document({
  creator: "",
  description: "",
  title: "",
  styles: {
    default: {
      document: {
        run: {
          font: "[user-specified font]",
          size: "[user-specified size in half-points]",
          color: "000000"
        }
      }
    }
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: "[user-specified in twips]",
          right: "[user-specified in twips]",
          bottom: "[user-specified in twips]",
          left: "[user-specified in twips]"
        }
      }
    },
    children: [/* document content */]
  }]
});
```

**Invisible table template** (for spatial layouts):
```javascript
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

new Table({
  width: { size: 100, type: WidthType.PERCENTAGE }, // Auto-adjust to page
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  rows: [
    new TableRow({
      children: [
        new TableCell({
          borders: noBorders,
          width: { size: 50, type: WidthType.PERCENTAGE }, // Auto-adjust to content
          children: [/* content */]
        }),
        // Additional cells...
      ]
    })
  ]
});
```

### Step 4: Quality Verification

Before finalizing, verify:
- ✓ Professional appearance (would you deliver this to a client?)
- ✓ Clean formatting (no artifacts or weird spacing)
- ✓ Tables look good immediately (no manual resizing needed)
- ✓ Text alignment matches source
- ✓ Font sizes reproduced exactly (not interpreted as headings)
- ✓ All formatting is editable (margins, fonts can be adjusted)
- ✓ Special characters preserved
- ✓ Spatial layouts maintained (side-by-side text)

### Step 5: Export

Generate the .docx file:
```javascript
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('[output-path]', buffer);
  console.log('SUCCESS: [filename]');
  process.exit(0);
}).catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
```

## User Settings Integration

The skill works with dynamic user settings passed via the prompt:

**Typography:**
- Font name (e.g., "Arial", "Calibri")
- Font size in points (converted to half-points for docx-js)

**Margins:**
- Top, right, bottom, left (in inches, converted to twips: 1 inch = 1440 twips)

**Special requests:**
- Replace signatures: yes/no
- Add page markers: yes/no
- Skip headers/footers: yes/no

**Custom overrides:**
- User can provide additional instructions per conversion
- Skill handles core patterns, prompt provides specifics

## Resources

### references/

This skill includes optional reference documentation:

**`docx-js-patterns.md`**: Additional docx-js code examples and patterns for complex scenarios. Load this reference when encountering unusual layout challenges or when more detailed code guidance is needed.

**Future additions**: Users can add custom pattern examples as they encounter new document types. Update the skill version to include proven patterns that improve conversion quality.
