FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-ind tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
# The application imports Sentence Transformers only for the optional local
# EmbeddingGemma provider. Compose uses Ollama, so evaluation/Torch packages
# are excluded from this runtime image.
RUN sed '/^# Evaluation Dependencies/,$d' requirements.txt > /tmp/requirements-runtime.txt \
    && pip install --no-cache-dir -r /tmp/requirements-runtime.txt
COPY app ./app
COPY skills ./skills
RUN mkdir -p /app/data/chroma /app/data/uploads /app/data/agent /models/huggingface

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
