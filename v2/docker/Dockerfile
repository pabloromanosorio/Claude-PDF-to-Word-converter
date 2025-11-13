FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 8000

# Set Python path
ENV PYTHONPATH=/app

# Run app
CMD ["python", "backend/app.py"]
