from __future__ import annotations

import logging
import mimetypes
import uuid
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests

from src.downloaders.base import (
    ContentDownloader,
    ContentNotFoundError,
    ContentPrivateError,
    DownloadError,
    DownloadLimits,
    DownloadResult,
    LimitExceededError,
    MediaFile,
)
from src.utils.url_validator import check_host_ssrf

logger = logging.getLogger(__name__)

DIRECT_EXTENSIONS = {
    # Video
    ".mp4",
    ".webm",
    ".mkv",
    ".mov",
    ".avi",
    ".flv",
    # Audio
    ".mp3",
    ".wav",
    ".m4a",
    ".ogg",
    ".aac",
    # Image
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".gif",
}


class DirectFileDownloader(ContentDownloader):
    """Downloader for direct media links (HTTP/HTTPS file downloads)."""

    def supports(self, url: str) -> bool:
        """Check if URL ends with known media extension or returns media content-type."""
        try:
            parsed = urlparse(url)
            ext = Path(parsed.path).suffix.lower()
            if ext in DIRECT_EXTENSIONS:
                return True
        except Exception:
            return False
        return False

    def download(self, url: str, dest_dir: Path, limits: DownloadLimits) -> DownloadResult:
        """Download file directly with streaming, redirect SSRF checks, and size limits."""
        dest_dir.mkdir(parents=True, exist_ok=True)
        max_bytes = limits.max_size_mb * 1024 * 1024

        current_url = url
        redirect_count = 0
        max_redirects = 5

        # Follow redirects with SSRF verification on each hop
        session = requests.Session()
        session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36 Alitheia/1.0"
                )
            }
        )

        response: requests.Response | None = None
        while redirect_count <= max_redirects:
            parsed = urlparse(current_url)
            if not parsed.hostname:
                raise DownloadError(f"Invalid URL hostname: {current_url}")

            check_host_ssrf(parsed.hostname, parsed.port)

            try:
                response = session.get(
                    current_url,
                    stream=True,
                    timeout=limits.timeout_sec,
                    allow_redirects=False,
                )
            except requests.RequestException as e:
                raise DownloadError(f"HTTP request failed: {e}") from e

            if response.status_code in (301, 302, 303, 307, 308):
                location = response.headers.get("Location")
                if not location:
                    raise DownloadError("Redirect response missing Location header")
                current_url = urljoin(current_url, location)
                redirect_count += 1
                continue

            break

        if redirect_count > max_redirects or response is None:
            raise DownloadError("Exceeded maximum redirects")

        if response.status_code == 404:
            raise ContentNotFoundError(f"Direct file returned 404: {current_url}")
        if response.status_code in (401, 403):
            raise ContentPrivateError(f"Access forbidden ({response.status_code}): {current_url}")
        if not response.ok:
            raise DownloadError(f"Download failed with status {response.status_code}")

        # Check content length header if provided
        content_length = response.headers.get("Content-Length")
        if content_length:
            try:
                length_val = int(content_length)
                if length_val > max_bytes:
                    raise LimitExceededError(
                        f"File size {length_val} exceeds limit of {max_bytes} bytes"
                    )
            except ValueError:
                pass

        # Determine filename and extension
        content_type = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
        url_path = urlparse(current_url).path
        ext = Path(url_path).suffix.lower()
        if not ext and content_type:
            ext = mimetypes.guess_extension(content_type) or ""

        file_id = uuid.uuid4().hex[:12]
        filename = f"{file_id}{ext if ext else '.bin'}"
        target_path = dest_dir / filename

        # Stream write to disk
        downloaded_bytes = 0
        try:
            with open(target_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=64 * 1024):
                    if not chunk:
                        continue
                    downloaded_bytes += len(chunk)
                    if downloaded_bytes > max_bytes:
                        target_path.unlink(missing_ok=True)
                        raise LimitExceededError(
                            f"Downloaded size exceeded limit of {limits.max_size_mb} MB"
                        )
                    f.write(chunk)
        finally:
            response.close()

        # Classify media type
        mime = content_type or mimetypes.guess_type(target_path.name)[0] or "application/octet-stream"
        if mime.startswith("video/") or ext in {".mp4", ".webm", ".mkv", ".mov", ".avi"}:
            media_type = "video"
        elif mime.startswith("audio/") or ext in {".mp3", ".wav", ".m4a", ".ogg"}:
            media_type = "audio"
        else:
            media_type = "image"

        media_file = MediaFile(
            path=target_path,
            media_type=media_type,
            mime_type=mime,
            size_bytes=downloaded_bytes,
        )

        return DownloadResult(
            media_files=[media_file],
            caption=None,
            author_handle=None,
            posted_at=None,
            raw_metadata={"headers": dict(response.headers), "url": current_url},
        )
