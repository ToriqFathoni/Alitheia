from __future__ import annotations

import os


class Config:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://alitheia:alitheia_secret@postgres:5432/alitheia",
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")
    STORAGE_LOCAL_PATH: str = os.getenv("STORAGE_LOCAL_PATH", "/tmp/alitheia")
    STORAGE_TTL_HOURS: int = int(os.getenv("STORAGE_TTL_HOURS", "24"))
    MAX_DOWNLOAD_MB: int = int(os.getenv("MAX_DOWNLOAD_MB", "200"))
    MAX_VIDEO_SECONDS: int = int(os.getenv("MAX_VIDEO_SECONDS", "600"))
    DOWNLOAD_TIMEOUT_SECONDS: int = int(os.getenv("DOWNLOAD_TIMEOUT_SECONDS", "60"))
    ALLOWED_PLATFORMS: list[str] = [
        p.strip().lower()
        for p in os.getenv("ALLOWED_PLATFORMS", "instagram,tiktok,twitter,x.com").split(",")
        if p.strip()
    ]
    STT_MODEL_SIZE: str = os.getenv("STT_MODEL_SIZE", "small")
    OCR_LANGUAGES: list[str] = [
        lang.strip().lower()
        for lang in os.getenv("OCR_LANGUAGES", "ind,eng").split(",")
        if lang.strip()
    ]
    OCR_MIN_CONFIDENCE: float = float(os.getenv("OCR_MIN_CONFIDENCE", "0.5"))
    OCR_MAX_FRAMES: int = int(os.getenv("OCR_MAX_FRAMES", "30"))
    QUEUE_KEY: str = os.getenv("QUEUE_KEY", "alitheia:jobs")
    COOKIES_FILE: str = os.getenv("COOKIES_FILE", "/app/cookies.txt")
