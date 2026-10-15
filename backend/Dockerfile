FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/ /app/backend/
COPY demo_repo/ /app/demo_repo/
COPY replays/ /app/replays/

ENV PYTHONPATH=/app
ENV FALKORDB_HOST=falkordb
ENV FALKORDB_PORT=6379

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
