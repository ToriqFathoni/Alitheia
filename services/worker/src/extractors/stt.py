from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from src.config import Config

logger = logging.getLogger(__name__)


@dataclass
class TranscriptSegment:
    id: int
    start: float
    end: float
    text: str
    confidence: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Transcript:
    language: str
    full_text: str
    segments: list[dict[str, Any]] = field(default_factory=list)
    provider: str = "faster-whisper"


class SpeechToTextProvider:
    """Speech-to-text extractor using faster-whisper with lazy initialization."""

    def __init__(
        self,
        model_size: str | None = None,
        device: str = "cpu",
        compute_type: str = "int8",
    ) -> None:
        self.model_size = model_size or Config.STT_MODEL_SIZE
        self.device = device
        self.compute_type = compute_type
        self._model: Any = None

    def _get_model(self) -> Any:
        """Lazily initialize and return WhisperModel."""
        if self._model is None:
            try:
                from faster_whisper import WhisperModel

                logger.info(
                    "Loading faster-whisper model '%s' (device: %s, compute: %s)...",
                    self.model_size,
                    self.device,
                    self.compute_type,
                )
                self._model = WhisperModel(
                    self.model_size,
                    device=self.device,
                    compute_type=self.compute_type,
                )
            except Exception as e:
                logger.error("Failed to load faster-whisper model: %s", e, exc_info=True)
                raise
        return self._model

    def transcribe(
        self,
        audio_path: Path,
        language: str | None = None,
    ) -> Transcript:
        """
        Transcribe audio file into structured transcript.
        Returns an empty Transcript if transcription fails or audio is silent.
        """
        if not audio_path.is_file() or audio_path.stat().st_size == 0:
            logger.warning("Audio file is missing or empty: %s", audio_path)
            return Transcript(language="", full_text="", segments=[], provider="faster-whisper")

        try:
            model = self._get_model()
            logger.info("Transcribing audio file %s...", audio_path)
            segments_gen, info = model.transcribe(
                str(audio_path),
                language=language,
                beam_size=5,
            )

            segments: list[dict[str, Any]] = []
            text_parts: list[str] = []

            for seg in segments_gen:
                clean_text = seg.text.strip()
                if not clean_text:
                    continue
                text_parts.append(clean_text)
                segments.append(
                    {
                        "id": seg.id,
                        "start": round(seg.start, 2),
                        "end": round(seg.end, 2),
                        "text": clean_text,
                        "avg_logprob": round(seg.avg_logprob, 4) if hasattr(seg, "avg_logprob") else None,
                        "no_speech_prob": (
                            round(seg.no_speech_prob, 4) if hasattr(seg, "no_speech_prob") else None
                        ),
                    }
                )

            full_text = " ".join(text_parts).strip()
            detected_language = getattr(info, "language", "") or language or ""

            logger.info(
                "STT completed for %s: %d segments, %d chars (lang: %s)",
                audio_path,
                len(segments),
                len(full_text),
                detected_language,
            )

            return Transcript(
                language=detected_language,
                full_text=full_text,
                segments=segments,
                provider="faster-whisper",
            )
        except Exception as e:
            logger.warning("Transcription failed for %s: %s", audio_path, e, exc_info=True)
            return Transcript(
                language="",
                full_text="",
                segments=[],
                provider="faster-whisper",
            )
