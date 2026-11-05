from __future__ import annotations

import logging
from pathlib import Path

from src.downloaders.base import (
    ContentDownloader,
    DownloadError,
    DownloadLimits,
    DownloadResult,
)
from src.downloaders.direct import DirectFileDownloader
from src.downloaders.thirdparty import ThirdPartyDownloader
from src.downloaders.ytdlp import YtDlpDownloader
from src.utils.url_validator import UnsupportedPlatformError

logger = logging.getLogger(__name__)


class DownloaderResolver:
    """Orchestrates available downloaders and resolves appropriate adapter.

    Order: yt-dlp (primary) → third-party fallback (savett.cc) → direct download.
    If yt-dlp fails (e.g. auth required), automatically falls back to third-party services.
    """

    def __init__(self, downloaders: list[ContentDownloader] | None = None) -> None:
        if downloaders is None:
            self.downloaders: list[ContentDownloader] = [
                YtDlpDownloader(),
                ThirdPartyDownloader(),
                DirectFileDownloader(),
            ]
        else:
            self.downloaders = downloaders

    def get_downloader(self, url: str) -> ContentDownloader | None:
        """Find the first downloader that supports the given URL."""
        for downloader in self.downloaders:
            if downloader.supports(url):
                return downloader
        return None

    def download(
        self,
        url: str,
        dest_dir: Path,
        limits: DownloadLimits | None = None,
    ) -> DownloadResult:
        """
        Resolve downloader and perform download.
        Tries each supporting downloader in order. If one fails, falls back to the next.
        Raises UnsupportedPlatformError if no adapter supports the URL.
        """
        active_limits = limits or DownloadLimits()

        # Collect all downloaders that support this URL
        supporting = [d for d in self.downloaders if d.supports(url)]

        if not supporting:
            logger.warning("No downloader adapter supports URL: %s", url)
            raise UnsupportedPlatformError(f"No downloader available for URL: {url}")

        last_error: Exception | None = None
        for downloader in supporting:
            try:
                logger.info("Trying %s for %s", downloader.__class__.__name__, url)
                result = downloader.download(url, dest_dir, active_limits)
                logger.info("Successfully downloaded with %s", downloader.__class__.__name__)
                return result
            except Exception as e:
                logger.warning(
                    "%s failed for %s: %s. Trying next downloader...",
                    downloader.__class__.__name__,
                    url,
                    e,
                )
                last_error = e

        # All downloaders failed
        raise DownloadError(
            f"All downloaders failed for {url}. Last error: {last_error}"
        )
