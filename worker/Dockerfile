FROM python:3.12-slim-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scripts/download_models.sh scripts/download_models.sh
COPY models/checksums.txt models/checksums.txt
RUN chmod +x scripts/download_models.sh && ./scripts/download_models.sh

COPY src ./src

ENV PYTHONPATH=/app \
    PORT=8080

EXPOSE 8080

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
