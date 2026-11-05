"""Storage backends."""

from src.storage.base import StorageBackend
from src.storage.local import LocalStorageBackend

__all__ = [
    "StorageBackend",
    "LocalStorageBackend",
]
