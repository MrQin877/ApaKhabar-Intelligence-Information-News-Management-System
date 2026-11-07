FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-ind tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
# The hosted API runtime does not need evaluation tooling or local embedding weights.
RUN sed '/^# Evaluation Dependencies/,$d' requirements.txt > /tmp/requirements-runtime.txt \
    && pip install --no-cache-dir -r /tmp/requirements-runtime.txt
COPY app ./app
COPY skills ./skills
RUN mkdir -p /app/data/chroma /app/data/uploads /app/data/agent

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
