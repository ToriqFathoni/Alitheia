from __future__ import annotations

import logging
import mimetypes
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import yt_dlp
from yt_dlp.utils import DownloadError as YtDlpNativeDownloadError

from src.config import Config
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

logger = logging.getLogger(__name__)

YTDLP_SUPPORTED_DOMAINS = {
    "instagram.com",
    "tiktok.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "youtu.be",
    "facebook.com",
    "fb.watch",
    "threads.net",
}


class YtDlpDownloader(ContentDownloader):
    """Media downloader leveraging yt-dlp API."""

    def supports(self, url: str) -> bool:
        """Check if URL domain is supported by yt-dlp extractor."""
        try:
            parsed = urlparse(url)
            host = (parsed.hostname or "").lower()
            for domain in YTDLP_SUPPORTED_DOMAINS:
                if host == domain or host.endswith(f".{domain}") or domain in host:
                    return True

            # If not in explicitly whitelisted domains, check if yt-dlp has a non-generic extractor
            extractors = yt_dlp.extractor.gen_extractors()
            for ext in extractors:
                if ext.suitable(url) and ext.IE_NAME.lower() != "generic":
                    return True
        except Exception as e:
            logger.debug("yt-dlp support check failed for %s: %s", url, e)
        return False

    def download(self, url: str, dest_dir: Path, limits: DownloadLimits) -> DownloadResult:
        """Download content with yt-dlp, enforcing limits and mapping errors."""
        dest_dir.mkdir(parents=True, exist_ok=True)
        unique_id = uuid.uuid4().hex[:12]
        out_template = str(dest_dir / f"{unique_id}_%(id)s.%(ext)s")

        max_bytes = limits.max_size_mb * 1024 * 1024
        ydl_opts = {
            "outtmpl": out_template,
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "writethumbnail": True,
            "max_filesize": max_bytes,
            "socket_timeout": limits.timeout_sec,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "ignoreerrors": False,
            "http_headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            },
        }

        # Add cookies file if it exists
        cookies_file = Path(Config.COOKIES_FILE)
        if cookies_file.is_file():
            ydl_opts["cookiefile"] = str(cookies_file)
            logger.info("Using cookies file: %s", cookies_file)
        else:
            logger.debug("No cookies file found at %s", cookies_file)

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
        except YtDlpNativeDownloadError as e:
            err_msg = str(e).lower()
            logger.warning("yt-dlp download error for %s: %s", url, e)
            if any(k in err_msg for k in ["private", "login required", "authentication", "permission"]):
                raise ContentPrivateError(f"Content is private or restricted: {e}") from e
            if any(k in err_msg for k in ["not found", "404", "deleted", "unavailable", "does not exist"]):
                raise ContentNotFoundError(f"Content not found: {e}") from e
            if any(k in err_msg for k in ["max-filesize", "too large"]):
                raise LimitExceededError(f"File size exceeded {limits.max_size_mb} MB") from e
            raise DownloadError(f"Failed to download with yt-dlp: {e}") from e
        except Exception as e:
            logger.error("Unexpected yt-dlp error for %s: %s", url, e, exc_info=True)
            raise DownloadError(f"Unexpected yt-dlp download failure: {e}") from e

        if not info:
            raise DownloadError("yt-dlp returned empty info dictionary")

        # Check duration limit
        duration = info.get("duration")
        if duration and limits.max_duration_sec and duration > limits.max_duration_sec:
            raise LimitExceededError(
                f"Video duration {duration}s exceeds maximum limit of {limits.max_duration_sec}s"
            )

        # Parse posted_at date
        posted_at: datetime | None = None
        if info.get("timestamp"):
            posted_at = datetime.fromtimestamp(info["timestamp"], tz=timezone.utc)
        elif info.get("upload_date"):
            try:
                posted_at = datetime.strptime(info["upload_date"], "%Y%m%d").replace(tzinfo=timezone.utc)
            except Exception:
                posted_at = None

        caption = info.get("description") or info.get("title")
        author_handle = (
            info.get("uploader_id")
            or info.get("uploader")
            or info.get("channel")
            or info.get("creator")
        )

        # Scan dest_dir for downloaded files with prefix unique_id
        media_files: list[MediaFile] = []
        thumbnail_file: MediaFile | None = None

        for path in dest_dir.glob(f"{unique_id}_*"):
            if not path.is_file():
                continue
            ext = path.suffix.lower()
            mime_type, _ = mimetypes.guess_type(path.name)
            size_bytes = path.stat().st_size

            if ext in {".jpg", ".jpeg", ".png", ".webp"}:
                if "thumb" in path.name.lower() or thumbnail_file is None:
                    thumbnail_file = MediaFile(
                        path=path,
                        media_type="thumbnail",
                        mime_type=mime_type or "image/jpeg",
                        size_bytes=size_bytes,
                    )
                    continue

            media_type = "video" if ext in {".mp4", ".mkv", ".webm", ".mov"} else "image"
            media_files.append(
                MediaFile(
                    path=path,
                    media_type=media_type,
                    mime_type=mime_type or f"{media_type}/{ext.lstrip('.')}",
                    size_bytes=size_bytes,
                    duration_sec=float(duration) if duration else None,
                )
            )

        # Fallback: if no video/image files were classified, check any created files
        if not media_files and thumbnail_file:
            # Maybe the primary asset was an image (e.g. Instagram photo)
            media_files.append(
                MediaFile(
                    path=thumbnail_file.path,
                    media_type="image",
                    mime_type=thumbnail_file.mime_type,
                    size_bytes=thumbnail_file.size_bytes,
                )
            )

        return DownloadResult(
            media_files=media_files,
            thumbnail=thumbnail_file,
            caption=caption,
            author_handle=author_handle,
            posted_at=posted_at,
            raw_metadata=info,
        )
