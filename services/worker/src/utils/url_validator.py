from __future__ import annotations

import ipaddress
import logging
import socket
from urllib.parse import urlparse

from src.config import Config

logger = logging.getLogger(__name__)


class InvalidUrlError(Exception):
    """Raised when URL syntax or protocol is invalid."""


class UnsupportedPlatformError(Exception):
    """Raised when URL domain is not in the allowed platforms list."""


class SsrfError(Exception):
    """Raised when URL resolves to an unsafe / private IP address."""


def is_ip_safe(ip_str: str) -> bool:
    """Check if an IP address is public and safe to connect to (prevents SSRF)."""
    try:
        ip = ipaddress.ip_address(ip_str)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return False
        return True
    except ValueError:
        return False


def check_host_ssrf(hostname: str, port: int | None = None) -> None:
    """Resolve hostname and ensure none of the resolved IPs are private or link-local."""
    try:
        addr_info = socket.getaddrinfo(hostname, port or 80, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise InvalidUrlError(f"Could not resolve hostname '{hostname}': {e}") from e

    if not addr_info:
        raise InvalidUrlError(f"No IP addresses found for hostname '{hostname}'")

    for item in addr_info:
        ip = item[4][0]
        if not is_ip_safe(ip):
            logger.warning("SSRF blocked: Host '%s' resolved to unsafe IP '%s'", hostname, ip)
            raise SsrfError(f"Host '{hostname}' resolved to prohibited IP address '{ip}'")


def is_platform_allowed(hostname: str, allowed_platforms: list[str]) -> bool:
    """Check if hostname belongs to an allowed platform."""
    if not allowed_platforms or "*" in allowed_platforms:
        return True

    hostname_clean = hostname.lower()
    for platform in allowed_platforms:
        platform_clean = platform.strip().lower()
        if not platform_clean:
            continue
        # Exact match, subdomain match, or domain contains platform token
        if (
            hostname_clean == platform_clean
            or hostname_clean.endswith(f".{platform_clean}")
            or platform_clean in hostname_clean
        ):
            return True

    return False


def validate_url(
    url: str,
    allowed_platforms: list[str] | None = None,
    enforce_allowed_platforms: bool = True,
) -> str:
    """
    Validate URL syntax, protocol, platform whitelist, and SSRF prevention.

    Returns the cleaned, validated URL string.
    """
    if not url or not isinstance(url, str):
        raise InvalidUrlError("URL must be a non-empty string")

    cleaned_url = url.strip()
    parsed = urlparse(cleaned_url)

    if parsed.scheme not in ("http", "https"):
        raise InvalidUrlError(f"Unsupported protocol '{parsed.scheme}': only http and https are allowed")

    hostname = parsed.hostname
    if not hostname:
        raise InvalidUrlError("URL is missing a valid hostname")

    # Platform validation
    platforms = allowed_platforms if allowed_platforms is not None else Config.ALLOWED_PLATFORMS
    if enforce_allowed_platforms and platforms and not is_platform_allowed(hostname, platforms):
        raise UnsupportedPlatformError(
            f"Platform '{hostname}' is not supported. Allowed: {', '.join(platforms)}"
        )

    # SSRF protection: resolve and verify IP safety
    check_host_ssrf(hostname, parsed.port)

    return cleaned_url
