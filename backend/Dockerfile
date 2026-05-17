FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies required for PostgreSQL and compilers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    findutils \
    && rm -rf /var/lib/apt/lists/*

# Copy the source code in first
COPY . /app/

# Automatically scan and locate any file named *requirements*.txt (ignoring case)
# and install it instantly.
RUN REQ_FILE=$(find . -maxdepth 3 -iname "*requirements*.txt" | head -n 1); \
    if [ -n "$REQ_FILE" ]; then \
        echo "✅ Found dependencies file at: $REQ_FILE"; \
        pip install --no-cache-dir --upgrade pip; \
        pip install --no-cache-dir -r "$REQ_FILE"; \
    else \
        echo "❌ CRITICAL: No requirements text file found anywhere!"; \
        exit 1; \
    fi

RUN pip install --no-cache-dir gunicorn

# Run static files collection safely
RUN python manage.py collectstatic --noinput || echo "Static asset compilation bypassed"

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]