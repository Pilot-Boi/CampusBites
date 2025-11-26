# Use Python 3.11 as base image to match development requirements
FROM python:3.11-slim

# Prevent Python from writing .pyc files and ensure output is flushed
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies (build-essential is useful for compiling wheels)
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# Copy project files
COPY . .

# Expose the development server port
EXPOSE 8000

# Run migrations and start the Django development server
CMD ["bash", "-c", "python manage.py makemigrations events --noinput && python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8000"]
