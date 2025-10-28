# API Reference

This document describes the Flask API endpoints for the PDF to Word converter.

## Base URL

When running locally: `http://127.0.0.1:5000`

## Endpoints

### Health Check

**GET** `/api/health`

Check if the server is running.

**Response:**
```json
{
  "status": "ok"
}
```

---

### API Key Management

**GET** `/api/api-key`

Check if an API key is configured.

**Response:**
```json
{
  "hasApiKey": true
}
```

**POST** `/api/api-key`

Save Anthropic API key.

**Request Body:**
```json
{
  "apiKey": "sk-ant-..."
}
```

**Response:**
```json
{
  "success": true
}
```

---

### Settings Management

**GET** `/api/settings`

Get current user settings.

**Response:**
```json
{
  "font": "Arial",
  "fontSize": 12,
  "margin": 1.0,
  "replaceSignatures": true,
  "addPageMarkers": true,
  "model": "claude-sonnet-4-5-20250929",
  "customInstructions": ""
}
```

**POST** `/api/settings`

Save user settings.

**Request Body:** Same structure as GET response.

---

### Prompt Management

**GET** `/api/prompt`

Get current prompt (custom or default).

**Response:**
```json
{
  "prompt": "Convert this document...",
  "isCustom": false
}
```

**POST** `/api/prompt`

Save custom prompt.

**Request Body:**
```json
{
  "customPrompt": "Your custom prompt here..."
}
```

**DELETE** `/api/prompt`

Reset to default prompt (delete custom prompt).

---

### Cost Estimation

**POST** `/api/estimate-cost`

Estimate conversion cost before processing.

**Request:**
- Content-Type: `multipart/form-data`
- `file`: PDF or image file
- `pageRange`: (optional) Page range like "1-5, 7"

**Response:**
```json
{
  "page_count": 10,
  "estimated_cost_low": 0.0850,
  "estimated_cost_avg": 0.1275,
  "estimated_cost_high": 0.1700
}
```

---

### Page Count

**POST** `/api/page-count`

Get page count from PDF.

**Request:**
- Content-Type: `multipart/form-data`
- `file`: PDF file

**Response:**
```json
{
  "pageCount": 25
}
```

---

### Document Conversion

**POST** `/api/convert`

Convert document to Word format.

**Request:**
- Content-Type: `multipart/form-data`
- `file`: PDF or image file
- `settings`: JSON string with conversion settings
- `pageRange`: (optional) Page range like "1-5, 7"

**Response:**
```json
{
  "success": true,
  "filename": "document.docx",
  "actual_cost": 0.1234,
  "download_url": "/api/download/document.docx"
}
```

**Error Response:**
```json
{
  "error": "Error message here"
}
```

---

### File Download

**GET** `/api/download/<filename>`

Download converted file.

**Response:** Binary file download

---

## Models

### Available Models

- `claude-haiku-4-5-20251001`: Fastest, ~$0.01/page
- `claude-sonnet-4-5-20250929`: Best quality, ~$0.02/page

### Settings Object

```typescript
{
  font: string;           // e.g., "Arial", "Times New Roman"
  fontSize: number;       // e.g., 12
  margin: number;         // inches, e.g., 1.0
  replaceSignatures: boolean;
  addPageMarkers: boolean;
  model: string;          // Model ID
  customInstructions?: string;
}
```

## Error Codes

- `400`: Bad request (missing file, invalid parameters)
- `404`: File not found
- `500`: Server error (conversion failed, API error)

## Notes

- Maximum file size: 50MB
- Supported formats: PDF, JPG, PNG
- Large documents (>90 pages) are automatically batched
- API calls use exponential backoff retry (3 attempts)
