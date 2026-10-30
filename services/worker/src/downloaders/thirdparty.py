"""Third-party download service fallback (e.g. savett.cc for TikTok)."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from src.downloaders.base import (
    ContentDownloader,
    ContentNotFoundError,
    DownloadError,
    DownloadLimits,
    DownloadResult,
    LimitExceededError,
    MediaFile,
)

logger = logging.getLogger(__name__)

# Platforms that savett.cc supports
SAVETT_SUPPORTED_DOMAINS = {
    "tiktok.com",
    "instagram.com",
    "instagr.am",
}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)


class ThirdPartyDownloader(ContentDownloader):
    """Fallback downloader using savett.cc when yt-dlp fails."""

    def __init__(self) -> None:
        self._session: requests.Session | None = None

    def _get_session(self) -> requests.Session:
        if self._session is None:
            self._session = requests.Session()
            self._session.headers.update({
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            })
        return self._session

    def supports(self, url: str) -> bool:
        """Check if URL domain is supported by this fallback."""
        try:
            parsed = urlparse(url)
            host = (parsed.hostname or "").lower()
            for domain in SAVETT_SUPPORTED_DOMAINS:
                if host == domain or host.endswith(f".{domain}"):
                    return True
        except Exception:
            pass
        return False

    def download(self, url: str, dest_dir: Path, limits: DownloadLimits) -> DownloadResult:
        """Download via savett.cc scraping."""
        dest_dir.mkdir(parents=True, exist_ok=True)
        session = self._get_session()

        logger.info("Attempting third-party download for: %s", url)

        try:
            # Step 1: Get the main page to obtain CSRF token
            page_resp = session.get(
                "https://savett.cc/en1/",
                timeout=limits.timeout_sec,
            )
            page_resp.raise_for_status()

            # Extract CSRF token
            soup = BeautifulSoup(page_resp.text, "html.parser")
            csrf_input = soup.find("input", {"name": "csrf_token"})
            csrf_token = csrf_input["value"] if csrf_input else ""

            # Step 2: Submit the URL
            download_resp = session.post(
                "https://savett.cc/en1/download",
                data={"url": url, "csrf_token": csrf_token},
                timeout=limits.timeout_sec,
                allow_redirects=True,
            )
            download_resp.raise_for_status()

            # Step 3: Parse the response page for download links
            result_soup = BeautifulSoup(download_resp.text, "html.parser")

            # Look for download links (usually <a> tags with download attribute or specific classes)
            download_links: list[dict[str, str]] = []

            # Search for video download links
            for a_tag in result_soup.find_all("a", href=True):
                href = a_tag["href"]
                text = a_tag.get_text(strip=True).lower()
                classes = " ".join(a_tag.get("class", []))

                if any(kw in text for kw in ["download", "mp4", "video", "no watermark"]):
                    download_links.append({
                        "url": href,
                        "type": "video",
                        "label": a_tag.get_text(strip=True),
                    })
                elif any(kw in text for kw in ["mp3", "audio", "music"]):
                    download_links.append({
                        "url": href,
                        "type": "audio",
                        "label": a_tag.get_text(strip=True),
                    })
                elif "download" in classes or "btn" in classes:
                    if href.startswith("http") and not href.startswith("https://savett.cc"):
                        download_links.append({
                            "url": href,
                            "type": "video",
                            "label": a_tag.get_text(strip=True),
                        })

            # Also look for direct video source tags
            for video_tag in result_soup.find_all("video"):
                src = video_tag.get("src")
                if src:
                    download_links.append({"url": src, "type": "video", "label": "video"})
                for source_tag in video_tag.find_all("source"):
                    src = source_tag.get("src")
                    if src:
                        download_links.append({"url": src, "type": "video", "label": "video"})

            # Also look for image tags (for Instagram photos / TikTok slides)
            for img_tag in result_soup.find_all("img"):
                src = img_tag.get("src", "")
                if src and "savett" not in src and "logo" not in src and "favicon" not in src:
                    alt = img_tag.get("alt", "")
                    if any(kw in alt.lower() for kw in ["tiktok", "video", "thumbnail", "preview"]):
                        download_links.append({"url": src, "type": "thumbnail", "label": alt})

            # Extract caption/description from the page
            caption = None
            caption_el = result_soup.find("p", class_=re.compile(r"desc|caption|title", re.I))
            if caption_el:
                caption = caption_el.get_text(strip=True)
            if not caption:
                # Try h3/h4 that might contain the video title
                for tag in result_soup.find_all(["h3", "h4"]):
                    text = tag.get_text(strip=True)
                    if text and "download" not in text.lower() and len(text) > 10:
                        caption = text
                        break

            if not download_links:
                # Check for error messages on the page
                error_el = result_soup.find(class_=re.compile(r"error|alert|danger", re.I))
                if error_el:
                    error_text = error_el.get_text(strip=True)
                    raise ContentNotFoundError(f"Service returned error: {error_text}")
                raise DownloadError(
                    "Could not find download links on savett.cc response. "
                    "The service may have changed its page structure."
                )

            # Step 4: Download the best video file
            # Prefer "no watermark" or first video link
            best_link = download_links[0]
            for link in download_links:
                if "no watermark" in link.get("label", "").lower():
                    best_link = link
                    break

            media_url = best_link["url"]
            if not media_url.startswith("http"):
                media_url = "https://savett.cc" + media_url

            logger.info("Downloading from: %s (%s)", media_url[:80], best_link.get("label", ""))

            # Stream download with size check
            max_bytes = limits.max_size_mb * 1024 * 1024
            media_resp = session.get(
                media_url,
                stream=True,
                timeout=limits.timeout_sec,
                headers={"Referer": "https://savett.cc/en1/"},
            )
            media_resp.raise_for_status()

            # Check content length
            content_length = int(media_resp.headers.get("Content-Length", 0))
            if content_length > max_bytes:
                raise LimitExceededError(
                    f"File size {content_length / 1024 / 1024:.1f}MB exceeds limit {limits.max_size_mb}MB"
                )

            # Determine file extension
            content_type = media_resp.headers.get("Content-Type", "")
            ext = ".mp4"
            if "audio" in content_type or best_link["type"] == "audio":
                ext = ".mp3"
            elif "image" in content_type:
                ext = ".jpg"

            unique_id = uuid.uuid4().hex[:12]
            filename = f"{unique_id}_savett{ext}"
            filepath = dest_dir / filename

            # Download to file
            downloaded = 0
            with open(filepath, "wb") as f:
                for chunk in media_resp.iter_content(chunk_size=8192):
                    if chunk:
                        downloaded += len(chunk)
                        if downloaded > max_bytes:
                            filepath.unlink(missing_ok=True)
                            raise LimitExceededError(
                                f"Download exceeded {limits.max_size_mb}MB limit"
                            )
                        f.write(chunk)

            media_type = best_link["type"]
            if media_type == "audio":
                mime_type = "audio/mpeg"
            elif ext == ".jpg":
                mime_type = "image/jpeg"
                media_type = "image"
            else:
                mime_type = "video/mp4"

            media_files = [
                MediaFile(
                    path=filepath,
                    media_type=media_type,
                    mime_type=mime_type,
                    size_bytes=downloaded,
                )
            ]

            return DownloadResult(
                media_files=media_files,
                caption=caption,
                raw_metadata={"source": "savett.cc", "links_found": len(download_links)},
            )

        except (ContentNotFoundError, LimitExceededError, DownloadError):
            raise
        except requests.exceptions.Timeout:
            raise DownloadError("Third-party download service timed out")
        except requests.exceptions.RequestException as e:
            raise DownloadError(f"Third-party download failed: {e}") from e
        except Exception as e:
            logger.error("Unexpected error in third-party download: %s", e, exc_info=True)
            raise DownloadError(f"Third-party download error: {e}") from e
