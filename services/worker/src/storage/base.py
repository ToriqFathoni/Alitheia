from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path


class StorageBackend(ABC):
    @abstractmethod
    def put(self, check_id: str, filename: str, data: bytes) -> str:
        """Store raw bytes for a check and return its storage_key."""
        ...

    @abstractmethod
    def get_path(self, storage_key: str) -> Path:
        """Resolve storage_key to a local Path on disk."""
        ...

    @abstractmethod
    def delete(self, storage_key: str) -> None:
        """Delete file associated with storage_key if it exists."""
        ...

    @abstractmethod
    def exists(self, storage_key: str) -> bool:
        """Check whether storage_key exists."""
        ...

    @abstractmethod
    def get_check_dir(self, check_id: str) -> Path:
        """Return directory path for a check, ensuring it exists."""
        ...
