# backend/Dockerfile
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential gcc g++ libffi-dev libssl-dev curl \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --upgrade pip setuptools wheel

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ⬇️ ⬇️ Copy BOTH app/ and worker/
COPY app ./app
COPY worker ./worker

EXPOSE 8080


