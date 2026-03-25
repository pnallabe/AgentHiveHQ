# =============================================================================
# Builder stage — compiles native extensions (psycopg2, scikit-learn, etc.)
# =============================================================================
FROM python:3.11-slim AS builder

WORKDIR /build

# Install only the compile-time system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install all packages into a separate target dir for clean copying
RUN pip install --no-cache-dir --target=/deps -r requirements.txt


# =============================================================================
# Runtime stage — lean image, no build tools, non-root user
# =============================================================================
FROM python:3.11-slim AS runtime

# Runtime-only system libs (libpq for psycopg2 shared library)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN adduser --disabled-password --gecos "" appuser

WORKDIR /app

# Pull compiled packages from builder
COPY --from=builder /deps /deps
ENV PYTHONPATH=/deps

# Copy application source — exclude dev/test artefacts via .dockerignore
COPY . .

# Hand ownership to appuser before switching
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Health-check so orchestrators know when the API is ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

