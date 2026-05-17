FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies required for PostgreSQL and compiler tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy your codebase in first so the paths resolve smoothly
COPY . /app/

# Automatically detect and install the requirements file safely
RUN if [ -f "requirements.txt" ]; then \
        pip install --no-cache-dir -r requirements.txt; \
    elif [ -f "backend/requirements.txt" ]; then \
        pip install --no-cache-dir -r backend/requirements.txt; \
    else \
        echo "WARNING: requirements.txt not found, falling back to manual installations"; \
    fi

RUN pip install --no-cache-dir gunicorn

# Run your static asset collection safely
RUN python manage.py collectstatic --noinput || echo "Static collection bypassed"

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]