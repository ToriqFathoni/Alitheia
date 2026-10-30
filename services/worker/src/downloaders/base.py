from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol


class DownloadError(Exception):
    """Base exception for download failures."""

    def __init__(self, message: str, code: str = "DOWNLOAD_FAILED") -> None:
        super().__init__(message)
        self.code = code


class ContentPrivateError(DownloadError):
    def __init__(self, message: str = "Content is private or requires authentication") -> None:
        super().__init__(message, code="CONTENT_PRIVATE")


class ContentNotFoundError(DownloadError):
    def __init__(self, message: str = "Content not found or has been deleted") -> None:
        super().__init__(message, code="CONTENT_NOT_FOUND")


class LimitExceededError(DownloadError):
    def __init__(self, message: str = "Content exceeded file size or duration limit") -> None:
        super().__init__(message, code="LIMIT_EXCEEDED")


@dataclass
class DownloadLimits:
    max_size_mb: int = 200
    max_duration_sec: int = 600
    timeout_sec: int = 60


@dataclass
class MediaFile:
    path: Path
    media_type: str  # video | image | audio | thumbnail
    mime_type: str | None = None
    size_bytes: int = 0
    duration_sec: float | None = None


@dataclass
class DownloadResult:
    media_files: list[MediaFile] = field(default_factory=list)
    thumbnail: MediaFile | None = None
    caption: str | None = None
    author_handle: str | None = None
    posted_at: datetime | None = None
    raw_metadata: dict[str, Any] = field(default_factory=dict)


class ContentDownloader(Protocol):
    def supports(self, url: str) -> bool:
        """Return True if this downloader can handle the given URL."""
        ...

    def download(self, url: str, dest_dir: Path, limits: DownloadLimits) -> DownloadResult:
        """Download media from the URL into dest_dir, respecting limits."""
        ...
