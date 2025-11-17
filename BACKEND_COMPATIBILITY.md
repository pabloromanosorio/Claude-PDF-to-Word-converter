# Backend Compatibility Summary

## Changes Made to Python Backend (Port 8000)

The Python FastAPI backend has been updated to work with the same frontend as the Node.js backend.

### Updates:

1. **File upload field name**: Changed from `file` to `pdf` to match Node.js
   ```python
   pdf: UploadFile = File(..., alias="pdf")
   ```

2. **Response format**: Updated to camelCase to match Node.js
   - `/api/convert` returns `jobId` (not `job_id`)
   - `/api/jobs/{job_id}/status` returns camelCase fields:
     - `currentStep` (not `current_step`)
     - `outputPath` (not `output_filename`)
     - `actualCost` (not `actual_cost`)
     - etc.

3. **Endpoint paths**: Updated to match Node.js exactly
   - `/api/jobs/{job_id}/status` (added `/status` suffix)

4. **Frontend static files**: Mounted `/js` directory for serving app.js

### Compatibility Matrix

| Feature | Node.js (Port 3000) | Python (Port 8000) | Status |
|---------|--------------------|--------------------|--------|
| Upload field name | `pdf` | `pdf` | ✅ Match |
| Response format | camelCase | camelCase | ✅ Match |
| Job status endpoint | `/api/jobs/:jobId/status` | `/api/jobs/{job_id}/status` | ✅ Match |
| Download endpoint | `/api/download/:jobId` | `/api/download/{job_id}` | ✅ Match |
| API key endpoints | `/api/api-key/*` | `/api/api-key/*` | ✅ Match |
| Stats endpoint | `/api/stats` | `/api/stats` | ✅ Match |

### Testing Both Backends

**Node.js (Code Generation):**
```bash
npm start
# Opens http://localhost:3000
```

**Python (Vision API):**
```bash
./start.sh
# Opens http://localhost:8000
```

Both backends now work with the same frontend!

### Key Differences (Implementation Only)

While the **API interface is identical**, the backends use different approaches:

- **Node.js**: Claude generates JavaScript code that creates the DOCX
- **Python**: Claude reads the PDF visually and uses the docx skill

Users can choose based on their needs:
- **Node.js**: Single executable packaging, simpler deployment
- **Python**: Better cost optimization (caching), WebSocket progress, database storage
