FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
      ffmpeg \
      tesseract-ocr tesseract-ocr-ind tesseract-ocr-eng \
      libgl1 libglib2.0-0t64 \
      ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create virtual environment
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

CMD ["python3", "-m", "src.main"]
