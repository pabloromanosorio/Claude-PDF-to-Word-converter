"""
File management service for uploads, storage, and cleanup.
"""

import os
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
import shutil

logger = logging.getLogger(__name__)


class FileService:
    """Service for file upload and cleanup management"""

    def __init__(self, upload_dir: Optional[Path] = None):
        """
        Initialize file service.

        Args:
            upload_dir: Directory for uploads. If None, uses default.
        """
        if upload_dir is None:
            self.upload_dir = Path.home() / '.pdf-converter' / 'uploads'
        else:
            self.upload_dir = Path(upload_dir)

        self.upload_dir.mkdir(parents=True, exist_ok=True)

        # Configuration
        self.max_file_age_hours = 24
        self.max_storage_mb = 500

    def save_file(self, file_data: bytes, filename: str) -> Path:
        """
        Save uploaded file.

        Args:
            file_data: File content bytes
            filename: Original filename

        Returns:
            Path to saved file
        """
        # Sanitize filename
        safe_filename = self._sanitize_filename(filename)

        # Add timestamp to avoid collisions
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        name_parts = safe_filename.rsplit('.', 1)
        if len(name_parts) == 2:
            unique_filename = f"{name_parts[0]}_{timestamp}.{name_parts[1]}"
        else:
            unique_filename = f"{safe_filename}_{timestamp}"

        file_path = self.upload_dir / unique_filename

        # Write file
        with open(file_path, 'wb') as f:
            f.write(file_data)

        logger.info(f"Saved file: {file_path} ({len(file_data)} bytes)")

        return file_path

    def get_file_path(self, job_id: str, filename: str) -> Path:
        """Get file path for a job"""
        safe_filename = self._sanitize_filename(filename)
        return self.upload_dir / f"{job_id}_{safe_filename}"

    def cleanup_old_files(self):
        """
        Remove files older than max_file_age_hours.

        Called periodically to prevent disk space issues.
        """
        cutoff_time = datetime.now() - timedelta(hours=self.max_file_age_hours)
        cutoff_timestamp = cutoff_time.timestamp()

        removed_count = 0
        removed_size = 0

        for file_path in self.upload_dir.glob('*'):
            if not file_path.is_file():
                continue

            # Check file age
            file_mtime = file_path.stat().st_mtime
            if file_mtime < cutoff_timestamp:
                try:
                    file_size = file_path.stat().st_size
                    file_path.unlink()
                    removed_count += 1
                    removed_size += file_size
                    logger.info(f"Cleaned up old file: {file_path.name}")
                except Exception as e:
                    logger.warning(f"Failed to delete {file_path}: {e}")

        if removed_count > 0:
            logger.info(
                f"Cleanup complete: Removed {removed_count} file(s), "
                f"freed {removed_size / 1024 / 1024:.2f} MB"
            )

    def enforce_storage_limit(self):
        """
        Remove oldest files if storage exceeds limit.

        Ensures total storage stays under max_storage_mb.
        """
        # Calculate current usage
        total_size = 0
        files_with_mtime = []

        for file_path in self.upload_dir.glob('*'):
            if file_path.is_file():
                size = file_path.stat().st_size
                mtime = file_path.stat().st_mtime
                total_size += size
                files_with_mtime.append((file_path, mtime, size))

        current_mb = total_size / 1024 / 1024

        if current_mb <= self.max_storage_mb:
            return  # Under limit, nothing to do

        logger.warning(
            f"Storage limit exceeded: {current_mb:.2f}MB / {self.max_storage_mb}MB"
        )

        # Sort by modification time (oldest first)
        files_with_mtime.sort(key=lambda x: x[1])

        # Remove oldest files until under limit
        removed_count = 0
        removed_size = 0

        for file_path, _, size in files_with_mtime:
            if current_mb <= self.max_storage_mb * 0.8:  # Leave 20% buffer
                break

            try:
                file_path.unlink()
                removed_count += 1
                removed_size += size
                current_mb -= size / 1024 / 1024
                logger.info(f"Removed old file to free space: {file_path.name}")
            except Exception as e:
                logger.warning(f"Failed to delete {file_path}: {e}")

        logger.info(
            f"Storage enforcement complete: Removed {removed_count} file(s), "
            f"freed {removed_size / 1024 / 1024:.2f} MB. "
            f"New usage: {current_mb:.2f}MB"
        )

    def get_storage_stats(self) -> dict:
        """
        Get storage usage statistics.

        Returns:
            Dict with:
                - total_files: int
                - total_size_mb: float
                - oldest_file_age_hours: float
        """
        total_files = 0
        total_size = 0
        oldest_mtime = None

        for file_path in self.upload_dir.glob('*'):
            if file_path.is_file():
                total_files += 1
                total_size += file_path.stat().st_size

                mtime = file_path.stat().st_mtime
                if oldest_mtime is None or mtime < oldest_mtime:
                    oldest_mtime = mtime

        if oldest_mtime:
            oldest_age_hours = (datetime.now().timestamp() - oldest_mtime) / 3600
        else:
            oldest_age_hours = 0

        return {
            'total_files': total_files,
            'total_size_mb': round(total_size / 1024 / 1024, 2),
            'oldest_file_age_hours': round(oldest_age_hours, 1)
        }

    def _sanitize_filename(self, filename: str) -> str:
        """
        Sanitize filename to prevent path traversal and other issues.

        Args:
            filename: Original filename

        Returns:
            Safe filename
        """
        # Remove path components
        filename = os.path.basename(filename)

        # Replace unsafe characters
        unsafe_chars = '<>:"/\\|?*'
        for char in unsafe_chars:
            filename = filename.replace(char, '_')

        # Limit length
        if len(filename) > 200:
            name_parts = filename.rsplit('.', 1)
            if len(name_parts) == 2:
                name, ext = name_parts
                filename = name[:190] + '.' + ext
            else:
                filename = filename[:200]

        return filename


# Global file service instance
_file_service_instance: Optional[FileService] = None


def get_file_service() -> FileService:
    """Get or create global file service instance"""
    global _file_service_instance
    if _file_service_instance is None:
        _file_service_instance = FileService()
    return _file_service_instance
