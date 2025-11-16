"""
Database models and initialization using SQLAlchemy.

Uses SQLite for local storage of:
- Jobs (conversion history)
- Configuration (settings, API keys)
- Daily usage statistics
"""

from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Boolean, JSON, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, date
from pathlib import Path
from typing import Optional
import os

Base = declarative_base()


class JobRecord(Base):
    """Conversion job record"""
    __tablename__ = 'jobs'

    id = Column(String, primary_key=True)
    filename = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    page_count = Column(Integer, nullable=False)
    page_range = Column(String, nullable=True)

    # Settings stored as JSON
    settings = Column(JSON, nullable=False)

    # Status
    status = Column(String, nullable=False, default='queued')
    progress = Column(Integer, default=0)
    current_step = Column(String, nullable=True)

    # Cost estimates
    estimated_cost_low = Column(Float, nullable=True)
    estimated_cost_avg = Column(Float, nullable=True)
    estimated_cost_high = Column(Float, nullable=True)
    actual_cost = Column(Float, nullable=True)

    # Token usage
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    cached_tokens = Column(Integer, nullable=True)

    # Output
    output_filename = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.now)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


class ConfigRecord(Base):
    """Application configuration"""
    __tablename__ = 'config'

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
    encrypted = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class DailyUsageRecord(Base):
    """Daily usage statistics"""
    __tablename__ = 'daily_usage'

    date = Column(String, primary_key=True)  # YYYY-MM-DD format
    total_conversions = Column(Integer, default=0)
    total_pages = Column(Integer, default=0)
    total_cost = Column(Float, default=0.0)
    total_input_tokens = Column(Integer, default=0)
    total_output_tokens = Column(Integer, default=0)
    total_cached_tokens = Column(Integer, default=0)


class Database:
    """Database manager with connection and session handling"""

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize database connection.

        Args:
            db_path: Path to SQLite database file. If None, uses default location.
        """
        if db_path is None:
            # Default: ~/.pdf-converter/converter.db
            db_dir = Path.home() / '.pdf-converter'
            db_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(db_dir / 'converter_v2.db')

        self.db_path = db_path
        self.engine = create_engine(
            f'sqlite:///{db_path}',
            echo=False,  # Set to True for SQL debugging
            connect_args={'check_same_thread': False}  # Allow multi-threading
        )

        # Create tables
        Base.metadata.create_all(self.engine)

        # Session factory
        self.SessionLocal = sessionmaker(bind=self.engine)

    def get_session(self) -> Session:
        """Get a new database session"""
        return self.SessionLocal()

    def close(self):
        """Close database connection"""
        self.engine.dispose()


# Global database instance (initialized in app startup)
_db_instance: Optional[Database] = None


def init_database(db_path: Optional[str] = None) -> Database:
    """
    Initialize the global database instance.

    Args:
        db_path: Optional path to database file

    Returns:
        Database instance
    """
    global _db_instance
    _db_instance = Database(db_path)
    return _db_instance


def get_db() -> Database:
    """
    Get the global database instance.

    Returns:
        Database instance

    Raises:
        RuntimeError: If database not initialized
    """
    if _db_instance is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return _db_instance


# Context manager for sessions
class db_session:
    """Context manager for database sessions with automatic commit/rollback"""

    def __init__(self):
        self.session: Optional[Session] = None

    def __enter__(self) -> Session:
        self.session = get_db().get_session()
        return self.session

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            # Exception occurred, rollback
            self.session.rollback()
        else:
            # Success, commit
            self.session.commit()

        self.session.close()


# Helper functions for common operations

def save_job(job_data: dict) -> JobRecord:
    """Save a new job to database"""
    with db_session() as session:
        job = JobRecord(**job_data)
        session.add(job)
        session.flush()
        return job


def get_job(job_id: str) -> Optional[JobRecord]:
    """Get job by ID"""
    with db_session() as session:
        return session.query(JobRecord).filter(JobRecord.id == job_id).first()


def update_job(job_id: str, **kwargs) -> bool:
    """Update job fields"""
    with db_session() as session:
        job = session.query(JobRecord).filter(JobRecord.id == job_id).first()
        if job:
            for key, value in kwargs.items():
                setattr(job, key, value)
            return True
        return False


def get_config(key: str) -> Optional[str]:
    """Get configuration value"""
    with db_session() as session:
        config = session.query(ConfigRecord).filter(ConfigRecord.key == key).first()
        return config.value if config else None


def set_config(key: str, value: str, encrypted: bool = False):
    """Set configuration value"""
    with db_session() as session:
        config = session.query(ConfigRecord).filter(ConfigRecord.key == key).first()
        if config:
            config.value = value
            config.encrypted = encrypted
            config.updated_at = datetime.now()
        else:
            config = ConfigRecord(key=key, value=value, encrypted=encrypted)
            session.add(config)


def update_daily_usage(pages: int, cost: float, input_tokens: int, output_tokens: int, cached_tokens: int):
    """Update daily usage statistics"""
    today = date.today().isoformat()

    with db_session() as session:
        usage = session.query(DailyUsageRecord).filter(DailyUsageRecord.date == today).first()

        if usage:
            usage.total_conversions += 1
            usage.total_pages += pages
            usage.total_cost += cost
            usage.total_input_tokens += input_tokens
            usage.total_output_tokens += output_tokens
            usage.total_cached_tokens += cached_tokens
        else:
            usage = DailyUsageRecord(
                date=today,
                total_conversions=1,
                total_pages=pages,
                total_cost=cost,
                total_input_tokens=input_tokens,
                total_output_tokens=output_tokens,
                total_cached_tokens=cached_tokens
            )
            session.add(usage)


def get_usage_stats(days: int = 30) -> dict:
    """Get usage statistics for the last N days"""
    from datetime import timedelta

    cutoff_date = (date.today() - timedelta(days=days)).isoformat()

    with db_session() as session:
        records = session.query(DailyUsageRecord).filter(
            DailyUsageRecord.date >= cutoff_date
        ).all()

        if not records:
            return {
                'total_conversions': 0,
                'total_pages': 0,
                'total_cost': 0.0,
                'avg_cost_per_page': 0.0,
                'avg_cost_per_conversion': 0.0,
                'cache_hit_rate': 0.0
            }

        total_conversions = sum(r.total_conversions for r in records)
        total_pages = sum(r.total_pages for r in records)
        total_cost = sum(r.total_cost for r in records)
        total_input = sum(r.total_input_tokens for r in records)
        total_output = sum(r.total_output_tokens for r in records)
        total_cached = sum(r.total_cached_tokens for r in records)

        # Calculate cache hit rate
        total_tokens = total_input + total_cached
        cache_hit_rate = total_cached / total_tokens if total_tokens > 0 else 0.0

        return {
            'total_conversions': total_conversions,
            'total_pages': total_pages,
            'total_cost': round(total_cost, 2),
            'avg_cost_per_page': round(total_cost / total_pages, 4) if total_pages > 0 else 0.0,
            'avg_cost_per_conversion': round(total_cost / total_conversions, 4) if total_conversions > 0 else 0.0,
            'cache_hit_rate': round(cache_hit_rate, 2)
        }
