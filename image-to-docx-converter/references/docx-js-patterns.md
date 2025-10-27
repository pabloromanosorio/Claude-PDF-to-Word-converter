# docx-js Patterns and Examples

This reference provides code patterns for common document creation scenarios using the docx-js library.

## Basic Imports

```javascript
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, BorderStyle, UnderlineType, WidthType, PageBreak } = require('docx');
```

## Document Creation Template

```javascript
const doc = new Document({
  // Empty metadata for clean output
  creator: "",
  description: "",
  title: "",
  subject: "",
  keywords: "",

  // Default styles
  styles: {
    default: {
      document: {
        run: {
          font: "Arial",      // User-specified
          size: 22,           // 11pt = 22 half-points
          color: "000000"     // Always black for CAT tools
        }
      }
    }
  },

  sections: [{
    properties: {
      page: {
        margin: {
          top: 1440,    // 1 inch = 1440 twips
          right: 1440,
          bottom: 1440,
          left: 1440
        }
      }
    },
    children: [
      // Document content goes here
    ]
  }]
});
```

## Paragraph Patterns

### Basic Paragraph

```javascript
new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 120, after: 120 },  // Spacing in twips
  children: [
    new TextRun({
      text: "Content here",
      size: 22,           // Half-points (11pt)
      color: "000000"     // Always black
    })
  ]
})
```

### Paragraph with Multiple Formatting

```javascript
new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { before: 120, after: 120 },
  children: [
    new TextRun({
      text: "Normal text ",
      size: 22,
      color: "000000"
    }),
    new TextRun({
      text: "bold text ",
      bold: true,
      size: 22,
      color: "000000"
    }),
    new TextRun({
      text: "italic text",
      italics: true,
      size: 22,
      color: "000000"
    })
  ]
})
```

### Paragraph with Underline

```javascript
new Paragraph({
  children: [
    new TextRun({
      text: "Underlined text",
      underline: { type: UnderlineType.SINGLE },
      size: 22,
      color: "000000"
    })
  ]
})
```

### Center-Aligned Paragraph

```javascript
new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 240, after: 240 },
  children: [
    new TextRun({
      text: "Centered heading",
      size: 28,  // 14pt
      bold: true,
      color: "000000"
    })
  ]
})
```

### Right-Aligned Paragraph

```javascript
new Paragraph({
  alignment: AlignmentType.RIGHT,
  children: [
    new TextRun({
      text: "Date: October 26, 2025",
      size: 22,
      color: "000000"
    })
  ]
})
```

## List Patterns

### Bulleted List

```javascript
new Paragraph({
  bullet: { level: 0 },
  spacing: { before: 60, after: 60 },
  children: [
    new TextRun({
      text: "First bullet point",
      size: 22,
      color: "000000"
    })
  ]
}),
new Paragraph({
  bullet: { level: 0 },
  spacing: { before: 60, after: 60 },
  children: [
    new TextRun({
      text: "Second bullet point",
      size: 22,
      color: "000000"
    })
  ]
})
```

### Numbered List

```javascript
new Paragraph({
  numbering: {
    reference: "my-numbering",
    level: 0
  },
  children: [
    new TextRun({
      text: "First item",
      size: 22,
      color: "000000"
    })
  ]
})
```

## Page Breaks

```javascript
// Insert between pages
new Paragraph({
  children: [new PageBreak()]
})
```

## Page Marker Pattern

```javascript
// For page 2 and onwards
new Paragraph({
  children: [
    new TextRun({
      text: "[Page 2 of the original]",
      size: 22,
      color: "000000"
    })
  ],
  spacing: { after: 240 }
})
```

## Invisible Table Patterns

### Two-Column Spatial Layout

Used for side-by-side content like "Name" on left, "Date" on right.

```javascript
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = {
  top: noBorder,
  bottom: noBorder,
  left: noBorder,
  right: noBorder
};

new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  rows: [
    new TableRow({
      children: [
        new TableCell({
          borders: noBorders,
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: "Name: John Doe",
                  size: 22,
                  color: "000000"
                })
              ]
            })
          ]
        }),
        new TableCell({
          borders: noBorders,
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "Date: 10/26/2025",
                  size: 22,
                  color: "000000"
                })
              ]
            })
          ]
        })
      ]
    })
  ]
})
```

### Three-Column Signature Block

```javascript
new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  rows: [
    new TableRow({
      children: [
        new TableCell({
          borders: noBorders,
          width: { size: 33, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "[Signature]", color: "000000" })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Name 1", size: 20, color: "000000" })]
            })
          ]
        }),
        new TableCell({
          borders: noBorders,
          width: { size: 34, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "[Signature]", color: "000000" })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Name 2", size: 20, color: "000000" })]
            })
          ]
        }),
        new TableCell({
          borders: noBorders,
          width: { size: 33, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "[Signature]", color: "000000" })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Name 3", size: 20, color: "000000" })]
            })
          ]
        })
      ]
    })
  ]
})
```

## Export Pattern

```javascript
// Save document to file
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/path/to/output.docx', buffer);
  console.log('SUCCESS: output.docx');
  process.exit(0);
}).catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
```

## Common Conversions

### Points to Half-Points
Font sizes in docx-js use half-points:
- 10pt = 20
- 11pt = 22
- 12pt = 24
- 14pt = 28
- 16pt = 32

### Inches to Twips
Margins and spacing use twips (1/1440 of an inch):
- 0.5" = 720 twips
- 1" = 1440 twips
- 1.5" = 2160 twips
- 2" = 2880 twips

### Spacing Units
Paragraph spacing (before/after) typically in twips:
- Small: 60-120 twips
- Medium: 120-240 twips
- Large: 240-480 twips

## Quality Checklist

Before exporting, ensure:
- ✓ All TextRuns have `color: "000000"`
- ✓ Font sizes match source (exact half-points)
- ✓ Alignment preserved (LEFT/CENTER/RIGHT/JUSTIFIED)
- ✓ Invisible tables use BorderStyle.NONE on all borders
- ✓ Table widths use PERCENTAGE for responsiveness
- ✓ No empty metadata fields (creator, title, etc. should be "")
- ✓ Proper spacing for professional appearance
- ✓ Page breaks between pages
