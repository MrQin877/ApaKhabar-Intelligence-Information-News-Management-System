FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-ind tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
ARG INSTALL_LOCAL_EMBEDDINGS=false
# Gemini embeddings use the Google GenAI SDK from requirements.txt. The local
# EmbeddingGemma alternative can be enabled explicitly at build time.
RUN sed '/^# Evaluation Dependencies/,$d' requirements.txt > /tmp/requirements-runtime.txt \
    && pip install --no-cache-dir -r /tmp/requirements-runtime.txt \
    && if [ "$INSTALL_LOCAL_EMBEDDINGS" = "true" ]; then \
         pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu \
         && pip install --no-cache-dir sentence-transformers==6.1.0; \
       fi
COPY app ./app
COPY skills ./skills
RUN mkdir -p /app/data/chroma /app/data/uploads /app/data/agent /app/data/huggingface

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
