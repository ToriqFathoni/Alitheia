from __future__ import annotations

import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def get_duration(media_path: Path) -> float:
    """Return duration of media file in seconds using ffprobe."""
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(media_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=15)
        val = result.stdout.strip()
        return float(val) if val else 0.0
    except (subprocess.SubprocessError, ValueError) as e:
        logger.warning("Could not determine duration for %s: %s", media_path, e)
        return 0.0


def has_audio_stream(video_path: Path) -> bool:
    """Check if media file contains at least one audio stream."""
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=15)
        return "audio" in result.stdout.lower()
    except subprocess.SubprocessError as e:
        logger.warning("ffprobe audio check failed for %s: %s", video_path, e)
        return False


def extract_audio(video_path: Path, output_path: Path) -> Path:
    """
    Extract audio from video as mono 16kHz WAV suitable for speech-to-text.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        str(output_path),
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=120)
        logger.info("Extracted audio to %s", output_path)
        return output_path
    except subprocess.CalledProcessError as e:
        logger.error("ffmpeg extract_audio failed: %s", e.stderr)
        raise RuntimeError(f"FFmpeg audio extraction failed: {e.stderr}") from e


def extract_frames(
    video_path: Path,
    output_dir: Path,
    fps: float = 1.0 / 3.0,
    max_frames: int = 30,
) -> list[Path]:
    """
    Extract frames at a given rate (default: 1 frame every 3 seconds),
    capped at max_frames.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    out_pattern = output_dir / "frame_%04d.jpg"

    fps_expr = f"{fps:.4f}"
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vf",
        f"fps={fps_expr}",
        "-vframes",
        str(max_frames),
        str(out_pattern),
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=180)
    except subprocess.CalledProcessError as e:
        logger.warning("ffmpeg extract_frames returned non-zero: %s", e.stderr)

    frames = sorted(output_dir.glob("frame_*.jpg"))

    # Fallback: if fps sampling yielded no frames (e.g. extremely short video), grab the first frame
    if not frames:
        fallback_path = output_dir / "frame_0001.jpg"
        cmd_fallback = [
            "ffmpeg",
            "-y",
            "-ss",
            "00:00:00",
            "-i",
            str(video_path),
            "-vframes",
            "1",
            str(fallback_path),
        ]
        try:
            subprocess.run(cmd_fallback, capture_output=True, text=True, check=True, timeout=30)
            if fallback_path.is_file():
                frames.append(fallback_path)
        except subprocess.SubprocessError as e:
            logger.warning("Fallback frame extraction failed: %s", e)

    logger.info("Extracted %d frames from %s", len(frames), video_path)
    return frames[:max_frames]
