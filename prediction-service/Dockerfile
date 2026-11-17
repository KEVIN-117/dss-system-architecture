FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --no-create-home app \
    && mkdir -p /app/artifacts /app/custom-datasets \
    && chown -R app:app /app/artifacts /app/custom-datasets

COPY pyproject.toml uv.lock ./
ARG UV_VERSION=0.11.32
RUN pip install --no-cache-dir "uv==${UV_VERSION}" \
    && uv sync --locked --extra ml --no-dev --no-install-project

COPY --chown=app:app config.py main.py dataset_contract.py feature_contract.py inference.py inference_adapters.py ./
COPY --chown=app:app training/ ./training/

ENV PATH="/app/.venv/bin:${PATH}" \
    PREDICTION_HOST=0.0.0.0 \
    PREDICTION_PORT=8000 \
    PREDICTION_ENV=production \
    PREDICTION_LOG_LEVEL=info \
    PREDICTION_RELOAD=false \
    WORKER_ARTIFACTS_DIR=/app/artifacts \
    PREDICTION_CUSTOM_DATASET_ROOT=/app/custom-datasets

USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PREDICTION_PORT', '8000') + '/', timeout=2)"

CMD ["python", "main.py"]
