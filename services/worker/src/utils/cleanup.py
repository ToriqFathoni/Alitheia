from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.storage.local import LocalStorageBackend

logger = logging.getLogger(__name__)


def cleanup_expired_files(storage: LocalStorageBackend | None = None) -> int:
    """
    Find media_assets past their expires_at TTL, delete the local file,
    and nullify the storage_key in the database.
    """
    from src.db import get_db_cursor
    from src.storage.local import LocalStorageBackend

    storage_backend = storage or LocalStorageBackend()
    cleaned_count = 0

    with get_db_cursor(commit=False) as cur:
        cur.execute(
            """
            SELECT id, storage_key
            FROM media_assets
            WHERE expires_at IS NOT NULL
              AND expires_at < NOW()
              AND storage_key IS NOT NULL
            """
        )
        expired_assets = cur.fetchall()

    if not expired_assets:
        logger.debug("No expired media assets found for cleanup")
        return 0

    logger.info("Found %d expired media assets to clean up", len(expired_assets))

    for asset in expired_assets:
        asset_id = asset["id"]
        storage_key = asset["storage_key"]

        if storage_key:
            try:
                storage_backend.delete(storage_key)
            except Exception as e:
                logger.warning("Error deleting file %s for asset %s: %s", storage_key, asset_id, e)

        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """
                UPDATE media_assets
                SET storage_key = NULL
                WHERE id = %s
                """,
                (asset_id,),
            )
        cleaned_count += 1

    logger.info("Successfully cleaned up %d expired media assets", cleaned_count)
    return cleaned_count
