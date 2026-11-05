from __future__ import annotations

import logging
import shutil
from pathlib import Path

from src.config import Config
from src.storage.base import StorageBackend

logger = logging.getLogger(__name__)


class LocalStorageBackend(StorageBackend):
    """Local filesystem storage implementation."""

    def __init__(self, base_path: str | Path | None = None) -> None:
        self.base_dir = Path(base_path or Config.STORAGE_LOCAL_PATH).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        logger.debug("LocalStorageBackend initialized at %s", self.base_dir)

    def get_check_dir(self, check_id: str) -> Path:
        """Return and ensure directory path for a check."""
        check_dir = (self.base_dir / check_id).resolve()
        check_dir.mkdir(parents=True, exist_ok=True)
        return check_dir

    def put(self, check_id: str, filename: str, data: bytes) -> str:
        """Write raw bytes for a check and return its storage_key."""
        check_dir = self.get_check_dir(check_id)
        safe_filename = Path(filename).name
        target_path = check_dir / safe_filename
        target_path.write_bytes(data)
        storage_key = f"{check_id}/{safe_filename}"
        logger.debug("Stored %d bytes to %s", len(data), storage_key)
        return storage_key

    def put_file(
        self,
        check_id: str,
        filename: str,
        src_path: Path,
        move: bool = False,
    ) -> str:
        """Copy or move an existing local file into check storage."""
        check_dir = self.get_check_dir(check_id)
        safe_filename = Path(filename).name
        target_path = check_dir / safe_filename

        if src_path.resolve() != target_path.resolve():
            if move:
                shutil.move(str(src_path), str(target_path))
            else:
                shutil.copy2(str(src_path), str(target_path))

        storage_key = f"{check_id}/{safe_filename}"
        logger.debug("Saved file %s to %s", src_path, storage_key)
        return storage_key

    def get_path(self, storage_key: str) -> Path:
        """Resolve storage_key to local absolute Path."""
        return (self.base_dir / storage_key).resolve()

    def delete(self, storage_key: str) -> None:
        """Delete file associated with storage_key if it exists."""
        target = self.get_path(storage_key)
        if target.is_file():
            try:
                target.unlink(missing_ok=True)
                logger.debug("Deleted storage file %s", storage_key)
            except OSError as e:
                logger.warning("Failed to delete storage file %s: %e", storage_key, e)

    def exists(self, storage_key: str) -> bool:
        """Check whether storage_key exists on disk."""
        return self.get_path(storage_key).is_file()

    def delete_check_dir(self, check_id: str) -> None:
        """Remove entire check folder on disk."""
        check_dir = (self.base_dir / check_id).resolve()
        if check_dir.is_dir():
            shutil.rmtree(check_dir, ignore_errors=True)
            logger.debug("Removed check directory for %s", check_id)
