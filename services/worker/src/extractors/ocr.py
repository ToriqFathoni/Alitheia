from __future__ import annotations

import logging
import subprocess
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from PIL import Image

from src.config import Config

logger = logging.getLogger(__name__)


@dataclass
class OcrBlock:
    text: str
    confidence: float
    box: list[Any] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class OcrResult:
    full_text: str
    blocks: list[dict[str, Any]] = field(default_factory=list)
    provider: str = "paddleocr"


class OcrProvider:
    """OCR extraction supporting PaddleOCR with fallback to Tesseract."""

    def __init__(
        self,
        min_confidence: float | None = None,
        languages: list[str] | None = None,
    ) -> None:
        self.min_confidence = (
            min_confidence if min_confidence is not None else Config.OCR_MIN_CONFIDENCE
        )
        self.languages = languages or Config.OCR_LANGUAGES
        self._engine: str | None = None
        self._paddle_ocr: Any = None

    def _init_engine(self) -> None:
        """Attempt to initialize PaddleOCR; fall back to Tesseract."""
        if self._engine is not None:
            return

        # 1. Try PaddleOCR
        try:
            from paddleocr import PaddleOCR

            # Map language code: PaddleOCR uses 'latin' or 'en' for Indonesian / English
            lang = "latin" if any(l in ["ind", "id", "latin"] for l in self.languages) else "en"
            logger.info("Initializing PaddleOCR (lang=%s)...", lang)
            self._paddle_ocr = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
            self._engine = "paddleocr"
            logger.info("PaddleOCR initialized successfully")
            return
        except Exception as e:
            logger.warning("PaddleOCR initialization failed, falling back to Tesseract: %s", e)

        # 2. Check Tesseract availability
        try:
            res = subprocess.run(["tesseract", "--version"], capture_output=True, text=True)
            if res.returncode == 0:
                self._engine = "tesseract"
                logger.info("Tesseract OCR fallback initialized successfully")
                return
        except Exception as e:
            logger.warning("Tesseract check failed: %s", e)

        # Neither available
        self._engine = "none"
        logger.error("No OCR engine available (neither PaddleOCR nor Tesseract could be loaded)")

    def extract(
        self,
        image_path: Path,
        languages: list[str] | None = None,
    ) -> OcrResult:
        """
        Extract text from image using active OCR engine with confidence filtering.
        Handles empty or textless images gracefully.
        """
        if not image_path.is_file() or image_path.stat().st_size == 0:
            logger.warning("Image file missing or empty: %s", image_path)
            return OcrResult(full_text="", blocks=[], provider="none")

        self._init_engine()

        if self._engine == "paddleocr":
            return self._extract_paddleocr(image_path)
        elif self._engine == "tesseract":
            return self._extract_tesseract(image_path, languages or self.languages)
        else:
            return OcrResult(full_text="", blocks=[], provider="none")

    def _extract_paddleocr(self, image_path: Path) -> OcrResult:
        """Run OCR using PaddleOCR."""
        try:
            results = self._paddle_ocr.ocr(str(image_path), cls=True)
            if not results or not results[0]:
                return OcrResult(full_text="", blocks=[], provider="paddleocr")

            blocks: list[dict[str, Any]] = []
            text_lines: list[str] = []

            for line in results[0]:
                if not line or len(line) < 2:
                    continue
                box = line[0]
                text, conf = line[1]
                conf_val = float(conf)

                if conf_val < self.min_confidence:
                    continue

                clean_text = text.strip()
                if clean_text:
                    text_lines.append(clean_text)
                    blocks.append(
                        {
                            "text": clean_text,
                            "confidence": round(conf_val, 4),
                            "box": box,
                        }
                    )

            full_text = "\n".join(text_lines)
            return OcrResult(
                full_text=full_text,
                blocks=blocks,
                provider="paddleocr",
            )
        except Exception as e:
            logger.warning("PaddleOCR extraction failed on %s: %s", image_path, e)
            return OcrResult(full_text="", blocks=[], provider="paddleocr")

    def _extract_tesseract(self, image_path: Path, languages: list[str]) -> OcrResult:
        """Run OCR using Tesseract (via pytesseract or CLI)."""
        # Build language string for tesseract (e.g. 'ind+eng')
        lang_str = "+".join([l for l in languages if l in ["ind", "eng", "osd"]]) or "eng"

        try:
            import pytesseract

            img = Image.open(image_path)
            data = pytesseract.image_to_data(
                img,
                lang=lang_str,
                output_type=pytesseract.Output.DICT,
            )

            blocks: list[dict[str, Any]] = []
            text_words: list[str] = []
            n_boxes = len(data["text"])

            for i in range(n_boxes):
                text = data["text"][i].strip()
                conf_str = data["conf"][i]

                try:
                    conf = float(conf_str) / 100.0
                except (ValueError, TypeError):
                    conf = -1.0

                if conf >= self.min_confidence and text:
                    text_words.append(text)
                    blocks.append(
                        {
                            "text": text,
                            "confidence": round(conf, 4),
                            "box": [
                                data["left"][i],
                                data["top"][i],
                                data["width"][i],
                                data["height"][i],
                            ],
                        }
                    )

            full_text = " ".join(text_words)
            return OcrResult(
                full_text=full_text,
                blocks=blocks,
                provider="tesseract",
            )
        except Exception:
            # Fallback to direct tesseract CLI
            return self._extract_tesseract_cli(image_path, lang_str)

    def _extract_tesseract_cli(self, image_path: Path, lang_str: str) -> OcrResult:
        """Direct tesseract CLI fallback if pytesseract fails."""
        try:
            cmd = ["tesseract", str(image_path), "stdout", "-l", lang_str]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if res.returncode == 0:
                text = res.stdout.strip()
                blocks = [{"text": text, "confidence": 0.8, "box": []}] if text else []
                return OcrResult(full_text=text, blocks=blocks, provider="tesseract-cli")
        except Exception as e:
            logger.warning("Tesseract CLI failed on %s: %s", image_path, e)

        return OcrResult(full_text="", blocks=[], provider="tesseract")
