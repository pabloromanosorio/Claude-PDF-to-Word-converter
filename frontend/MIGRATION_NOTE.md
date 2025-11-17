# Frontend Migration Required

The backend has been redesigned from Python FastAPI to Node.js Express.

## Key Changes Needed in app.js:

1. **Endpoint Change:**
   - OLD: `/api/convert-batch` (batch processing)
   - NEW: `/api/convert` (single file)
   - Process files one-by-one in a loop instead of batch upload

2. **Progress Tracking:**
   - OLD: WebSocket connections
   - NEW: REST polling (GET `/api/jobs/:jobId/status` every 2 seconds)
   
3. **Settings Format:**
   - Add: `enableLogging` from localStorage
   - Fix: margins need `* 1440` for DXA units
   - Remove: endpoints that don't exist (`/api/estimate-cost`, `/api/stats`)

4. **Download:**
   - Already correct: `/api/download/:jobId`

## Quick Fix (for now):
The API_BASE is already correct (window.location.origin).
The backend is compatible, just needs frontend code updates.

## Recommended Approach:
Review the implementation plan at:
docs/plans/2025-11-17-nodejs-code-generation-implementation.md
Task 8 has the detailed frontend updates needed.
