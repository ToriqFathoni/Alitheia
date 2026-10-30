from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from src.analysis.stub import AnalysisService
from src.config import Config
from src.db import (
    add_check_event,
    complete_check,
    delete_check_results,
    get_check,
    save_analysis,
    save_media_asset,
    save_ocr_result,
    save_source,
    save_transcript,
    update_check_status,
)
from src.downloaders.base import (
    DownloadError,
    DownloadLimits,
    DownloadResult,
    MediaFile,
)
from src.downloaders.resolver import DownloaderResolver
from src.extractors.ffmpeg_utils import (
    extract_audio,
    extract_frames,
    has_audio_stream,
)
from src.extractors.ocr import OcrProvider
from src.extractors.stt import SpeechToTextProvider, Transcript
from src.storage.local import LocalStorageBackend
from src.utils.url_validator import (
    InvalidUrlError,
    SsrfError,
    UnsupportedPlatformError,
    validate_url,
)

logger = logging.getLogger(__name__)


def _compute_sha256(file_path: Path) -> str:
    """Compute hex SHA-256 digest of a local file."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def run_check_pipeline(check_id: str) -> None:
    """
    Main pipeline orchestrator for processing a hoax detection check:
    1. Fetch check from DB and validate status
    2. Reset prior results if re-running (idempotency)
    3. Validate URL (SSRF & platform whitelist)
    4. Download content via DownloaderResolver
    5. Save media assets to DB and storage
    6. Extract audio -> Speech-To-Text (Whisper)
    7. Extract video frames / images -> OCR (PaddleOCR/Tesseract)
    8. Run multimodal analysis (stub)
    9. Complete check and log events
    """
    logger.info("Starting processing pipeline for check %s", check_id)

    # 1. Fetch check record
    check = get_check(check_id)
    if not check:
        logger.error("Check ID '%s' not found in database", check_id)
        return

    input_type = check.get("input_type", "url")

    # ── TEXT-BASED CHECK ─────────────────────────────────────────
    if input_type == "text":
        input_text = check.get("input_text", "")
        if not input_text:
            update_check_status(
                check_id=check_id,
                status="failed",
                progress_stage="init",
                error_code="EMPTY_TEXT",
                error_message="No text provided for analysis",
            )
            add_check_event(check_id, "init", "failed", "Empty text input")
            return

        logger.info("Text-based check — skipping download/extraction")
        add_check_event(check_id, "download", "completed", "Skipped (text input)")
        add_check_event(check_id, "extract", "completed", "Skipped (text input)")

        # Go directly to analysis
        update_check_status(check_id, status="analyzing", progress_stage="analysis")
        add_check_event(check_id, "analysis", "started", "Analyzing text input")

        try:
            analysis_service = AnalysisService()
            analysis_out = analysis_service.analyze(
                caption=input_text,
                transcript=None,
                ocr_texts=[],
                platform=None,
                posted_at=None,
                source_url=None,
            )

            save_analysis(
                check_id=check_id,
                verdict=analysis_out.verdict,
                confidence=analysis_out.confidence,
                summary=analysis_out.summary,
                explanation=analysis_out.explanation,
                claims_json=analysis_out.claims,
                model_version=analysis_out.model_version,
            )

            for src in analysis_out.sources:
                save_source(
                    check_id=check_id,
                    title=src.title,
                    url=src.url,
                    publisher=src.publisher,
                    published_at=src.published_at,
                    snippet=src.snippet,
                    stance=src.stance,
                )

            add_check_event(check_id, "analysis", "completed", f"Verdict: {analysis_out.verdict}")
        except Exception as e:
            logger.error("Text analysis failed for check %s: %s", check_id, e, exc_info=True)
            update_check_status(
                check_id=check_id,
                status="failed",
                progress_stage="analysis",
                error_code="ANALYSIS_FAILED",
                error_message=str(e),
            )
            add_check_event(check_id, "analysis", "failed", f"ANALYSIS_FAILED: {e}")
            return

        complete_check(check_id)
        add_check_event(check_id, "pipeline", "completed", "Text analysis finished")
        logger.info("Text check %s completed successfully", check_id)
        return

    # ── URL-BASED CHECK ──────────────────────────────────────────
    source_url = check.get("source_url") or check.get("normalized_url")
    if not source_url:
        logger.error("Check %s has no source_url", check_id)
        update_check_status(
            check_id=check_id,
            status="failed",
            progress_stage="init",
            error_code="INVALID_URL",
            error_message="Check has no source_url",
        )
        add_check_event(check_id, "init", "failed", "Missing source_url")
        return

    # Idempotent cleanup of old artifacts/records on retry
    try:
        delete_check_results(check_id)
    except Exception as e:
        logger.warning("Could not clear prior results for %s: %s", check_id, e)

    storage = LocalStorageBackend()
    check_dir = storage.get_check_dir(check_id)

    # 2. Validate URL
    try:
        validated_url = validate_url(source_url)
        add_check_event(check_id, "validation", "completed", f"Validated {validated_url}")
    except (InvalidUrlError, UnsupportedPlatformError, SsrfError) as e:
        err_code = (
            "SSRF_DETECTED"
            if isinstance(e, SsrfError)
            else "UNSUPPORTED_PLATFORM"
            if isinstance(e, UnsupportedPlatformError)
            else "INVALID_URL"
        )
        logger.error("Validation failed for check %s: %s", check_id, e)
        update_check_status(
            check_id=check_id,
            status="failed",
            progress_stage="validation",
            error_code=err_code,
            error_message=str(e),
        )
        add_check_event(check_id, "validation", "failed", f"{err_code}: {e}")
        return

    # 3. Download content
    update_check_status(check_id, status="downloading", progress_stage="download")
    add_check_event(check_id, "download", "started", f"Target: {validated_url}")

    resolver = DownloaderResolver()
    limits = DownloadLimits(
        max_size_mb=Config.MAX_DOWNLOAD_MB,
        max_duration_sec=Config.MAX_VIDEO_SECONDS,
        timeout_sec=Config.DOWNLOAD_TIMEOUT_SECONDS,
    )

    download_result: DownloadResult
    try:
        download_result = resolver.download(validated_url, check_dir, limits)
        add_check_event(
            check_id,
            "download",
            "completed",
            f"Downloaded {len(download_result.media_files)} media files",
        )
    except DownloadError as e:
        logger.error("Download failed for check %s: %s (code=%s)", check_id, e, e.code)
        update_check_status(
            check_id=check_id,
            status="failed",
            progress_stage="download",
            error_code=e.code,
            error_message=str(e),
        )
        add_check_event(check_id, "download", "failed", f"{e.code}: {e}")
        return
    except Exception as e:
        logger.error("Unexpected download failure for check %s: %s", check_id, e, exc_info=True)
        update_check_status(
            check_id=check_id,
            status="failed",
            progress_stage="download",
            error_code="DOWNLOAD_FAILED",
            error_message=str(e),
        )
        add_check_event(check_id, "download", "failed", f"DOWNLOAD_FAILED: {e}")
        return

    # 4. Save media assets to database
    expires_at = datetime.now(timezone.utc) + timedelta(hours=Config.STORAGE_TTL_HOURS)

    all_assets_to_save: list[MediaFile] = list(download_result.media_files)
    if download_result.thumbnail and download_result.thumbnail not in all_assets_to_save:
        all_assets_to_save.append(download_result.thumbnail)

    for media_file in all_assets_to_save:
        try:
            # Ensure file is registered in storage and obtain storage_key
            storage_key = storage.put_file(
                check_id=check_id,
                filename=media_file.path.name,
                src_path=media_file.path,
            )
            sha256_hash = _compute_sha256(media_file.path)
            save_media_asset(
                check_id=check_id,
                media_type=media_file.media_type,
                storage_key=storage_key,
                mime_type=media_file.mime_type,
                size_bytes=media_file.size_bytes or media_file.path.stat().st_size,
                duration_sec=media_file.duration_sec,
                sha256=sha256_hash,
                caption=download_result.caption,
                author_handle=download_result.author_handle,
                posted_at=download_result.posted_at,
                expires_at=expires_at,
            )
        except Exception as e:
            logger.warning("Failed saving media asset %s for check %s: %s", media_file.path, check_id, e)

    # 5. Extraction Stage
    update_check_status(check_id, status="extracting", progress_stage="extract")
    add_check_event(check_id, "extract", "started")

    # 6. Audio extraction & STT
    transcript_result: Transcript | None = None
    try:
        # Find video or audio file for STT
        video_files = [m for m in download_result.media_files if m.media_type == "video"]
        audio_files = [m for m in download_result.media_files if m.media_type == "audio"]

        target_audio_path: Path | None = None
        if audio_files:
            target_audio_path = audio_files[0].path
        elif video_files:
            video_path = video_files[0].path
            if has_audio_stream(video_path):
                extracted_wav = check_dir / f"{video_path.stem}_audio.wav"
                target_audio_path = extract_audio(video_path, extracted_wav)
            else:
                logger.info("Video %s has no audio stream; skipping STT", video_path)

        if target_audio_path and target_audio_path.is_file():
            add_check_event(check_id, "stt", "started", f"Processing {target_audio_path.name}")
            stt_provider = SpeechToTextProvider()
            transcript_result = stt_provider.transcribe(target_audio_path)

            if transcript_result and transcript_result.full_text:
                save_transcript(
                    check_id=check_id,
                    language=transcript_result.language,
                    full_text=transcript_result.full_text,
                    segments_json=transcript_result.segments,
                    provider=transcript_result.provider,
                )
                add_check_event(
                    check_id,
                    "stt",
                    "completed",
                    f"Transcribed {len(transcript_result.full_text)} characters",
                )
            else:
                add_check_event(check_id, "stt", "completed", "No speech detected in audio")
    except Exception as e:
        logger.warning("STT extraction encountered non-fatal error for %s: %s", check_id, e)
        add_check_event(check_id, "stt", "warning", f"STT failed non-fatally: {e}")

    # 7. Frame extraction & OCR
    ocr_texts: list[str] = []
    try:
        frames_to_ocr: list[Path] = []
        video_files = [m for m in download_result.media_files if m.media_type == "video"]
        image_files = [m for m in download_result.media_files if m.media_type == "image"]

        if video_files:
            frames_dir = check_dir / "frames"
            extracted_frames = extract_frames(
                video_files[0].path,
                frames_dir,
                fps=1.0 / 3.0,
                max_frames=Config.OCR_MAX_FRAMES,
            )
            frames_to_ocr.extend(extracted_frames)

        for img in image_files:
            if img.path.is_file():
                frames_to_ocr.append(img.path)

        if frames_to_ocr:
            add_check_event(
                check_id,
                "ocr",
                "started",
                f"Extracting text from {len(frames_to_ocr)} frames/images",
            )
            ocr_provider = OcrProvider()

            for idx, frame_path in enumerate(frames_to_ocr):
                frame_ocr = ocr_provider.extract(frame_path)
                if frame_ocr.full_text:
                    ocr_texts.append(frame_ocr.full_text)
                    frame_time = float(idx * 3.0) if video_files else None
                    save_ocr_result(
                        check_id=check_id,
                        source=frame_path.name,
                        frame_time_sec=frame_time,
                        full_text=frame_ocr.full_text,
                        blocks_json=frame_ocr.blocks,
                        provider=frame_ocr.provider,
                    )

            add_check_event(
                check_id,
                "ocr",
                "completed",
                f"OCR extracted text from {len(ocr_texts)} of {len(frames_to_ocr)} frames",
            )
        else:
            add_check_event(check_id, "ocr", "completed", "No images or video frames to OCR")
    except Exception as e:
        logger.warning("OCR extraction encountered non-fatal error for %s: %s", check_id, e)
        add_check_event(check_id, "ocr", "warning", f"OCR failed non-fatally: {e}")

    # 8. Analysis Stage
    update_check_status(check_id, status="analyzing", progress_stage="analysis")
    add_check_event(check_id, "analysis", "started")

    try:
        analysis_service = AnalysisService()
        analysis_out = analysis_service.analyze(
            caption=download_result.caption,
            transcript=transcript_result.full_text if transcript_result else None,
            ocr_texts=ocr_texts,
            platform=check.get("platform"),
            posted_at=download_result.posted_at,
            source_url=source_url,
        )

        save_analysis(
            check_id=check_id,
            verdict=analysis_out.verdict,
            confidence=analysis_out.confidence,
            summary=analysis_out.summary,
            explanation=analysis_out.explanation,
            claims_json=analysis_out.claims,
            model_version=analysis_out.model_version,
        )

        for src in analysis_out.sources:
            save_source(
                check_id=check_id,
                title=src.title,
                url=src.url,
                publisher=src.publisher,
                published_at=src.published_at,
                snippet=src.snippet,
                stance=src.stance,
            )

        add_check_event(check_id, "analysis", "completed", f"Verdict: {analysis_out.verdict}")
    except Exception as e:
        logger.error("Analysis stage failed for check %s: %s", check_id, e, exc_info=True)
        update_check_status(
            check_id=check_id,
            status="failed",
            progress_stage="analysis",
            error_code="ANALYSIS_FAILED",
            error_message=str(e),
        )
        add_check_event(check_id, "analysis", "failed", f"ANALYSIS_FAILED: {e}")
        return

    # 9. Completion
    complete_check(check_id)
    add_check_event(check_id, "pipeline", "completed", "Pipeline finished successfully")
    logger.info("Successfully finished pipeline for check %s", check_id)
