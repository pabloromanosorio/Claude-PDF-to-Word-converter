"""
FastAPI application for PDF to Word converter.

Features:
- Async file conversion with progress tracking
- Real-time WebSocket updates
- Cost estimation
- Usage statistics
- API key management
"""

import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect, Form
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from models import ConversionSettings, ConversionJob, CostEstimate, UsageStats, JobUpdate
from database import init_database, get_job, update_job, save_job, get_usage_stats
from config import get_config_manager
from core.converter import ConversionEngine
from services.cost_service import get_cost_service
from services.file_service import get_file_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# WebSocket connection manager
class ConnectionManager:
    """Manage WebSocket connections for job progress updates"""

    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, job_id: str, websocket: WebSocket):
        """Accept new connection"""
        await websocket.accept()
        self.active_connections[job_id] = websocket
        logger.info(f"WebSocket connected for job {job_id}")

    def disconnect(self, job_id: str):
        """Remove connection"""
        if job_id in self.active_connections:
            del self.active_connections[job_id]
            logger.info(f"WebSocket disconnected for job {job_id}")

    async def send_update(self, job_id: str, update: JobUpdate):
        """Send update to specific job's WebSocket"""
        if job_id in self.active_connections:
            try:
                # Use model_dump with mode='json' to apply JSON encoders (datetime -> isoformat)
                await self.active_connections[job_id].send_json(update.model_dump(mode='json'))
            except Exception as e:
                logger.error(f"Failed to send update to {job_id}: {e}")
                self.disconnect(job_id)


manager = ConnectionManager()


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    logger.info("Starting PDF to Word Converter v2.0")

    # Initialize database
    init_database()
    logger.info("Database initialized")

    # Start cleanup task
    cleanup_task = asyncio.create_task(periodic_cleanup())
    logger.info("Cleanup task started")

    yield

    # Shutdown
    logger.info("Shutting down...")
    cleanup_task.cancel()


# Create FastAPI app
app = FastAPI(
    title="PDF to Word Converter",
    description="Convert PDFs and images to editable Word documents using Claude AI",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware (for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Background cleanup task
async def periodic_cleanup():
    """Periodically clean up old files"""
    while True:
        try:
            await asyncio.sleep(3600)  # Every hour
            file_service = get_file_service()
            file_service.cleanup_old_files()
            file_service.enforce_storage_limit()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Cleanup task error: {e}")


# Background conversion task
async def process_conversion(job_id: str, file_path: str):
    """
    Process conversion in background with progress updates.

    Args:
        job_id: Job ID
        file_path: Path to uploaded file
    """
    try:
        # Get job from database
        job_record = get_job(job_id)
        if not job_record:
            logger.error(f"Job {job_id} not found")
            return

        # Parse settings
        settings = ConversionSettings(**job_record.settings)

        # Update status
        update_job(job_id, status='processing', started_at=datetime.now())
        await manager.send_update(job_id, JobUpdate(
            job_id=job_id,
            status='processing',
            progress=0,
            step='Starting conversion'
        ))

        # Get API key
        config_mgr = get_config_manager()
        api_key = config_mgr.get_api_key()

        if not api_key:
            raise Exception("API key not configured")

        # Create converter
        converter = ConversionEngine(api_key)

        # Get event loop for progress callbacks from thread
        loop = asyncio.get_event_loop()

        # Progress callback that can be called from worker thread
        def progress_callback_sync(update_dict):
            """Sync wrapper that schedules async callback on main loop"""
            progress = update_dict['progress']
            step = update_dict['step']

            # Update database (sync operation)
            update_job(job_id, progress=progress, current_step=step)

            # Schedule WebSocket update on main loop
            asyncio.run_coroutine_threadsafe(
                manager.send_update(job_id, JobUpdate(
                    job_id=job_id,
                    status='processing',
                    progress=progress,
                    step=step
                )),
                loop
            )

        # Convert
        result = await asyncio.to_thread(
            converter.convert_document,
            file_path,
            settings,
            progress_callback_sync
        )

        if result['success']:
            # Update database with success
            update_job(
                job_id,
                status='completed',
                progress=100,
                current_step='Complete',
                output_filename=result['output_path'],
                actual_cost=result['cost'],
                input_tokens=result['input_tokens'],
                output_tokens=result['output_tokens'],
                cached_tokens=result['cached_tokens'],
                completed_at=datetime.now()
            )

            # Update usage statistics
            from database import update_daily_usage
            job_record = get_job(job_id)
            update_daily_usage(
                pages=job_record.page_count,
                cost=result['cost'],
                input_tokens=result['input_tokens'],
                output_tokens=result['output_tokens'],
                cached_tokens=result['cached_tokens']
            )

            # Send final WebSocket update
            await manager.send_update(job_id, JobUpdate(
                job_id=job_id,
                status='completed',
                progress=100,
                step='Complete',
                output_filename=result['output_path'],
                actual_cost=result['cost']
            ))

            logger.info(f"Job {job_id} completed successfully")
        else:
            # Update database with failure
            update_job(
                job_id,
                status='failed',
                error_message=result['error'],
                completed_at=datetime.now()
            )

            # Send error update
            await manager.send_update(job_id, JobUpdate(
                job_id=job_id,
                status='failed',
                progress=0,
                step='Failed',
                error_message=result['error']
            ))

            logger.error(f"Job {job_id} failed: {result['error']}")

    except Exception as e:
        logger.error(f"Conversion task error for job {job_id}: {e}", exc_info=True)

        # Update database with failure
        update_job(
            job_id,
            status='failed',
            error_message=str(e),
            completed_at=datetime.now()
        )

        # Send error update
        await manager.send_update(job_id, JobUpdate(
            job_id=job_id,
            status='failed',
            progress=0,
            step='Failed',
            error_message=str(e)
        ))


# API Routes

@app.get("/")
async def root():
    """Serve frontend"""
    frontend_path = Path(__file__).parent.parent / 'frontend' / 'index.html'
    if frontend_path.exists():
        return FileResponse(frontend_path)
    return {"message": "PDF to Word Converter API v2.0"}


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "version": "2.0.0",
        "features": [
            "optimized_prompts",
            "prompt_caching",
            "multi_strategy_extraction",
            "comprehensive_retry",
            "websocket_progress"
        ]
    }


@app.post("/api/convert")
async def convert_document(
    pdf: UploadFile = File(..., alias="pdf"),
    settings: str = Form(...),
    page_range: Optional[str] = Form(None)
):
    """
    Upload and convert document.

    Returns job ID for tracking progress via REST polling.
    Compatible with Node.js frontend (field name 'pdf').
    """
    import json

    try:
        # Parse settings
        settings_dict = json.loads(settings)
        conversion_settings = ConversionSettings(**settings_dict)

        # Save uploaded file
        file_data = await pdf.read()
        file_service = get_file_service()
        job_id = str(uuid.uuid4())
        file_path = file_service.get_file_path(job_id, pdf.filename)
        file_path.write_bytes(file_data)

        # Get page count
        cost_service = get_cost_service()
        page_count = cost_service.get_page_count(str(file_path))

        # Estimate cost
        estimate = cost_service.estimate_cost(page_count, conversion_settings.model, page_range)

        # Create job record
        job_data = {
            'id': job_id,
            'filename': pdf.filename,
            'file_size': len(file_data),
            'page_count': page_count,
            'page_range': page_range,
            'settings': conversion_settings.model_dump(),
            'status': 'queued',
            'estimated_cost_low': estimate.estimated_cost_low,
            'estimated_cost_avg': estimate.estimated_cost_avg,
            'estimated_cost_high': estimate.estimated_cost_high
        }

        save_job(job_data)

        # Start conversion in background
        asyncio.create_task(process_conversion(job_id, str(file_path)))

        logger.info(f"Created job {job_id} for {pdf.filename}")

        # Match Node.js response format (jobId not job_id)
        return {
            "jobId": job_id,
            "status": "queued",
            "message": "Conversion started"
        }

    except Exception as e:
        logger.error(f"Error creating conversion job: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/jobs/{job_id}/status")
async def get_job_status(job_id: str):
    """Get job status - compatible with Node.js frontend (camelCase)"""
    job_record = get_job(job_id)

    if not job_record:
        raise HTTPException(status_code=404, detail="Job not found")

    # Match Node.js response format (camelCase)
    return {
        "id": job_record.id,
        "filename": job_record.filename,
        "fileSize": job_record.file_size,
        "status": job_record.status,
        "progress": job_record.progress or 0,
        "currentStep": job_record.current_step or "Queued",
        "outputPath": job_record.output_filename,
        "error": job_record.error_message,
        "inputTokens": job_record.input_tokens,
        "outputTokens": job_record.output_tokens,
        "actualCost": job_record.actual_cost,
        "createdAt": job_record.created_at.timestamp() * 1000 if job_record.created_at else None,
        "completedAt": job_record.completed_at.timestamp() * 1000 if job_record.completed_at else None
    }


@app.get("/api/download/{job_id}")
async def download_result(job_id: str):
    """Download converted file"""
    job_record = get_job(job_id)

    if not job_record:
        raise HTTPException(status_code=404, detail="Job not found")

    if job_record.status != 'completed':
        raise HTTPException(status_code=400, detail="Job not completed")

    if not job_record.output_filename:
        raise HTTPException(status_code=404, detail="Output file not found")

    file_path = Path(job_record.output_filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        file_path,
        media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        filename=file_path.name
    )


@app.websocket("/ws/jobs/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for real-time job progress.

    Usage from frontend:
        ws = new WebSocket('ws://localhost:8000/ws/jobs/{job_id}');
        ws.onmessage = (event) => {
            const update = JSON.parse(event.data);
            console.log(update.progress, update.step);
        };
    """
    await manager.connect(job_id, websocket)

    try:
        # Keep connection alive
        while True:
            # Wait for messages (client can send heartbeat)
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(job_id)
    except Exception as e:
        logger.error(f"WebSocket error for job {job_id}: {e}")
        manager.disconnect(job_id)


@app.get("/api/settings")
async def get_settings():
    """Get default settings"""
    config_mgr = get_config_manager()
    settings = config_mgr.get_settings()
    return settings.model_dump()


@app.post("/api/settings")
async def save_settings(settings: ConversionSettings):
    """Save default settings"""
    config_mgr = get_config_manager()
    config_mgr.save_settings(settings)
    return {"success": True}


@app.post("/api/estimate-cost")
async def estimate_cost(
    file: UploadFile = File(...),
    model: str = Form(...)
):
    """
    Estimate conversion cost for a file.

    Args:
        file: PDF or image file to estimate
        model: Model to use for conversion

    Returns:
        Cost estimate with page count and low/avg/high costs
    """
    temp_path = None
    try:
        # Get file service
        file_service = get_file_service()
        cost_service = get_cost_service()

        # Save file temporarily to read page count
        temp_path = file_service.save_upload(file)

        # Get page count
        page_count = cost_service.get_page_count(temp_path)

        # Get cost estimate
        estimate = cost_service.estimate_cost(page_count, model)

        return estimate.model_dump()

    except Exception as e:
        logger.error(f"Failed to estimate cost: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Clean up temporary file
        if temp_path and Path(temp_path).exists():
            Path(temp_path).unlink()


@app.get("/api/api-key/status")
async def get_api_key_status():
    """Check if API key is configured"""
    config_mgr = get_config_manager()
    return {"has_api_key": config_mgr.has_api_key()}


@app.post("/api/api-key")
async def save_api_key(data: dict):
    """Save API key"""
    api_key = data.get('api_key')

    if not api_key:
        raise HTTPException(status_code=400, detail="API key required")

    try:
        config_mgr = get_config_manager()
        config_mgr.save_api_key(api_key)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/stats")
async def get_stats():
    """Get usage statistics"""
    stats = get_usage_stats(days=30)
    return stats


@app.get("/api/storage")
async def get_storage_info():
    """Get storage information"""
    file_service = get_file_service()
    return file_service.get_storage_stats()


# Mount frontend files (serves js, css, etc.)
frontend_dir = Path(__file__).parent.parent / 'frontend'
if frontend_dir.exists():
    # Serve JS and other assets
    app.mount("/js", StaticFiles(directory=str(frontend_dir / 'js')), name="js")
    # Future: add /css if needed


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

@app.post("/api/convert-batch")
async def convert_batch(
    files: list[UploadFile] = File(...),
    settings: str = Form(...)
):
    """
    Upload and convert multiple documents.
    Files are processed sequentially to avoid overwhelming the API.
    
    Returns list of job IDs for tracking progress.
    """
    import json
    
    try:
        # Parse settings
        settings_dict = json.loads(settings)
        conversion_settings = ConversionSettings(**settings_dict)
        
        # Validate file count
        if len(files) > 20:
            raise HTTPException(status_code=400, detail="Maximum 20 files per batch")
        
        file_service = get_file_service()
        cost_service = get_cost_service()
        job_ids = []
        
        # Create jobs for all files
        for file in files:
            # Save uploaded file
            file_data = await file.read()
            job_id = str(uuid.uuid4())
            file_path = file_service.get_file_path(job_id, file.filename)
            file_path.write_bytes(file_data)
            
            # Get page count
            page_count = cost_service.get_page_count(str(file_path))
            
            # Estimate cost
            estimate = cost_service.estimate_cost(page_count, conversion_settings.model, None)
            
            # Create job record
            job_data = {
                'id': job_id,
                'filename': file.filename,
                'file_size': len(file_data),
                'page_count': page_count,
                'page_range': None,
                'settings': conversion_settings.model_dump(),
                'status': 'queued',
                'estimated_cost_low': estimate.estimated_cost_low,
                'estimated_cost_avg': estimate.estimated_cost_avg,
                'estimated_cost_high': estimate.estimated_cost_high
            }
            
            save_job(job_data)
            job_ids.append({
                'job_id': job_id,
                'filename': file.filename,
                'page_count': page_count,
                'estimated_cost': estimate.model_dump()
            })
            
            logger.info(f"Created batch job {job_id} for {file.filename}")
        
        # Start processing batch sequentially in background
        asyncio.create_task(process_batch(job_ids))
        
        return {
            "batch_size": len(files),
            "jobs": job_ids
        }
        
    except Exception as e:
        logger.error(f"Error creating batch conversion: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def process_batch(job_infos: list[dict]):
    """
    Process multiple jobs sequentially to avoid overwhelming API.

    Args:
        job_infos: List of job info dicts with job_id and filename
    """
    logger.info(f"Starting batch processing of {len(job_infos)} files")

    for i, job_info in enumerate(job_infos):
        job_id = job_info['job_id']
        filename = job_info['filename']
        logger.info(f"Processing batch file {i+1}/{len(job_infos)}: {job_id}")

        # Find file path
        file_service = get_file_service()
        file_path = file_service.get_file_path(job_id, filename)

        # Process this file (waits for completion)
        await process_conversion(job_id, str(file_path))

        # Small delay between files to be respectful to API
        if i < len(job_infos) - 1:
            await asyncio.sleep(2)

    logger.info(f"Batch processing complete: {len(job_infos)} files")

