from __future__ import annotations

import json
import logging
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Generator

import psycopg2
from psycopg2.extensions import connection as PgConnection
from psycopg2.extras import Json, RealDictCursor

from src.config import Config

logger = logging.getLogger(__name__)


def get_connection() -> PgConnection:
    """Return a new psycopg2 connection using DATABASE_URL."""
    return psycopg2.connect(Config.DATABASE_URL)


@contextmanager
def get_db_cursor(commit: bool = True) -> Generator[Any, None, None]:
    """Context manager for DB cursor with automatic commit/rollback and connection closure."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _ensure_json(val: Any) -> Json | None:
    """Helper to convert dict/list/string into psycopg2 Json adapter."""
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return Json(val)
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            return Json(parsed)
        except Exception:
            return Json(val)
    return Json(val)


def get_check(check_id: str) -> dict[str, Any] | None:
    """Fetch check row by ID as a dictionary."""
    with get_db_cursor(commit=False) as cur:
        cur.execute("SELECT * FROM checks WHERE id = %s", (check_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def update_check_status(
    check_id: str,
    status: str,
    progress_stage: str | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
) -> None:
    """Update check status, progress stage, and optional error fields."""
    with get_db_cursor() as cur:
        cur.execute(
            """
            UPDATE checks
            SET status = %(status)s,
                progress_stage = COALESCE(%(progress_stage)s, progress_stage),
                error_code = %(error_code)s,
                error_message = %(error_message)s,
                updated_at = NOW()
            WHERE id = %(check_id)s
            """,
            {
                "check_id": check_id,
                "status": status,
                "progress_stage": progress_stage,
                "error_code": error_code,
                "error_message": error_message,
            },
        )
    logger.debug(
        "Updated check %s status to '%s' (stage: %s)",
        check_id,
        status,
        progress_stage,
    )


def complete_check(check_id: str) -> None:
    """Mark check as completed."""
    with get_db_cursor() as cur:
        cur.execute(
            """
            UPDATE checks
            SET status = 'completed',
                progress_stage = 'done',
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = %s
            """,
            (check_id,),
        )
    logger.info("Marked check %s as completed", check_id)


def save_media_asset(
    check_id: str,
    media_type: str,
    storage_key: str | None = None,
    mime_type: str | None = None,
    size_bytes: int | None = None,
    duration_sec: float | None = None,
    sha256: str | None = None,
    caption: str | None = None,
    author_handle: str | None = None,
    posted_at: datetime | None = None,
    expires_at: datetime | None = None,
) -> str:
    """Insert media asset record and return its UUID."""
    with get_db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO media_assets (
                id, check_id, media_type, storage_key, mime_type,
                size_bytes, duration_sec, sha256, caption, author_handle,
                posted_at, expires_at, created_at
            ) VALUES (
                gen_random_uuid(), %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, NOW()
            ) RETURNING id
            """,
            (
                check_id,
                media_type,
                storage_key,
                mime_type,
                size_bytes,
                duration_sec,
                sha256,
                caption,
                author_handle,
                posted_at,
                expires_at,
            ),
        )
        row = cur.fetchone()
        asset_id = str(row["id"])
        logger.debug("Saved media asset %s for check %s", asset_id, check_id)
        return asset_id


def save_transcript(
    check_id: str,
    language: str | None,
    full_text: str,
    segments_json: Any,
    provider: str | None = None,
) -> str:
    """Insert transcript record and return its UUID."""
    with get_db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO transcripts (
                id, check_id, language, full_text, segments, provider, created_at
            ) VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s, NOW()
            ) RETURNING id
            """,
            (
                check_id,
                language,
                full_text,
                _ensure_json(segments_json),
                provider,
            ),
        )
        row = cur.fetchone()
        transcript_id = str(row["id"])
        logger.debug("Saved transcript %s for check %s", transcript_id, check_id)
        return transcript_id


def save_ocr_result(
    check_id: str,
    source: str,
    frame_time_sec: float | None,
    full_text: str,
    blocks_json: Any,
    provider: str | None = None,
) -> str:
    """Insert OCR result record and return its UUID."""
    with get_db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO ocr_results (
                id, check_id, source, frame_time_sec, full_text, blocks, provider, created_at
            ) VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s, %s, NOW()
            ) RETURNING id
            """,
            (
                check_id,
                source,
                frame_time_sec,
                full_text,
                _ensure_json(blocks_json),
                provider,
            ),
        )
        row = cur.fetchone()
        ocr_id = str(row["id"])
        logger.debug("Saved OCR result %s for check %s", ocr_id, check_id)
        return ocr_id


def save_analysis(
    check_id: str,
    verdict: str,
    confidence: float | None,
    summary: str | None,
    explanation: str,
    claims_json: Any,
    model_version: str | None = None,
) -> str:
    """Insert or update analysis result and return its UUID."""
    with get_db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO analysis_results (
                id, check_id, verdict, confidence, summary, explanation, claims, model_version, created_at
            ) VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, NOW()
            )
            ON CONFLICT (check_id) DO UPDATE SET
                verdict = EXCLUDED.verdict,
                confidence = EXCLUDED.confidence,
                summary = EXCLUDED.summary,
                explanation = EXCLUDED.explanation,
                claims = EXCLUDED.claims,
                model_version = EXCLUDED.model_version,
                created_at = NOW()
            RETURNING id
            """,
            (
                check_id,
                verdict,
                confidence,
                summary,
                explanation,
                _ensure_json(claims_json),
                model_version,
            ),
        )
        row = cur.fetchone()
        analysis_id = str(row["id"])
        logger.debug("Saved analysis %s for check %s", analysis_id, check_id)
        return analysis_id


def save_source(
    check_id: str,
    title: str | None,
    url: str,
    publisher: str | None = None,
    published_at: datetime | None = None,
    snippet: str | None = None,
    stance: str | None = None,
) -> str:
    """Insert source record and return its UUID."""
    with get_db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO sources (
                id, check_id, title, url, publisher, published_at, snippet, stance, created_at
            ) VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, NOW()
            ) RETURNING id
            """,
            (
                check_id,
                title,
                url,
                publisher,
                published_at,
                snippet,
                stance,
            ),
        )
        row = cur.fetchone()
        source_id = str(row["id"])
        logger.debug("Saved source %s for check %s", source_id, check_id)
        return source_id


def add_check_event(
    check_id: str,
    stage: str,
    status: str,
    detail: str | None = None,
) -> int:
    """Insert check event timeline log and return its autoincrement ID."""
    with get_db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO check_events (
                check_id, stage, status, detail, created_at
            ) VALUES (
                %s, %s, %s, %s, NOW()
            ) RETURNING id
            """,
            (check_id, stage, status, detail),
        )
        row = cur.fetchone()
        event_id = int(row["id"])
        logger.debug("Added check event %d: [%s:%s] %s", event_id, stage, status, detail or "")
        return event_id


def delete_check_results(check_id: str) -> None:
    """Delete prior extraction and analysis results for idempotency on re-run."""
    with get_db_cursor() as cur:
        cur.execute("DELETE FROM sources WHERE check_id = %s", (check_id,))
        cur.execute("DELETE FROM analysis_results WHERE check_id = %s", (check_id,))
        cur.execute("DELETE FROM ocr_results WHERE check_id = %s", (check_id,))
        cur.execute("DELETE FROM transcripts WHERE check_id = %s", (check_id,))
        cur.execute("DELETE FROM media_assets WHERE check_id = %s", (check_id,))
    logger.info("Deleted existing results for check %s (idempotent reset)", check_id)
