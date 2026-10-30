from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class SourceItem:
    title: str | None
    url: str
    publisher: str | None = None
    published_at: datetime | None = None
    snippet: str | None = None
    stance: str | None = None


@dataclass
class AnalysisOutput:
    verdict: str
    confidence: float
    summary: str | None
    explanation: str
    claims: list[dict[str, Any]] = field(default_factory=list)
    model_version: str = "stub-v1"
    sources: list[SourceItem] = field(default_factory=list)


class AnalysisService:
    """Stub analysis service returning placeholder verification results."""

    def analyze(
        self,
        caption: str | None,
        transcript: str | None,
        ocr_texts: list[str],
        platform: str | None,
        posted_at: datetime | None,
        source_url: str,
    ) -> AnalysisOutput:
        """
        Analyze extracted multimodality features.
        Returns dummy unverified output with stub metadata and original source.
        """
        logger.info("Executing stub analysis for %s (platform=%s)", source_url, platform)

        # Snippet preview from available text
        snippet_text = caption or transcript or (ocr_texts[0] if ocr_texts else "Original content URL")
        snippet = snippet_text[:250] + "..." if len(snippet_text) > 250 else snippet_text

        publisher = platform.capitalize() if platform else "Original Source"
        primary_source = SourceItem(
            title=f"Original post on {publisher}",
            url=source_url,
            publisher=publisher,
            published_at=posted_at,
            snippet=snippet,
            stance="NEUTRAL",
        )

        dummy_claim = {
            "claim": "Multimodal claim extraction pending NLP verification pipeline",
            "verdict": "UNVERIFIED",
            "confidence": 0.0,
        }

        return AnalysisOutput(
            verdict="unverified",
            confidence=0.0,
            summary="Analysis module not yet implemented",
            explanation=(
                "Analysis module not yet implemented. Media and text assets have been successfully "
                "ingested and stored for verification."
            ),
            claims=[dummy_claim],
            model_version="stub-v1",
            sources=[primary_source],
        )
