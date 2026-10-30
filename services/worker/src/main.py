from __future__ import annotations

import logging
import signal
import time
from typing import Any

import redis

from src.config import Config
from src.pipeline import run_check_pipeline
from src.utils.cleanup import cleanup_expired_files


def main() -> None:
    """Main consumer loop reading check job IDs from Redis."""
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] %(levelname)s [%(name)s]: %(message)s",
    )
    logger = logging.getLogger("alitheia-worker")
    logger.info("Initializing Alitheia Worker...")
    logger.info("Redis URL: %s", Config.REDIS_URL)
    logger.info("Database URL: %s", Config.DATABASE_URL.split("@")[-1])
    logger.info("Queue key: %s", Config.QUEUE_KEY)

    r = redis.from_url(Config.REDIS_URL)
    logger.info("Alitheia Worker started. Waiting for jobs...")

    running = True

    def handle_signal(sig: int, frame: Any) -> None:
        nonlocal running
        logger.info("Received termination signal %s. Shutting down gracefully...", sig)
        running = False

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    last_cleanup_time = time.time()
    cleanup_interval_sec = 3600  # Run TTL cleanup every hour

    while running:
        # Periodic TTL cleanup
        now = time.time()
        if now - last_cleanup_time > cleanup_interval_sec:
            try:
                cleanup_expired_files()
            except Exception as e:
                logger.warning("Periodic cleanup failed: %s", e)
            last_cleanup_time = now

        try:
            result = r.brpop(Config.QUEUE_KEY, timeout=5)
            if result:
                _, check_id = result
                check_id_str = check_id.decode("utf-8") if isinstance(check_id, bytes) else str(check_id)
                logger.info("Processing check: %s", check_id_str)
                try:
                    run_check_pipeline(check_id_str)
                    logger.info("Completed check: %s", check_id_str)
                except Exception as e:
                    logger.error("Failed check %s: %s", check_id_str, e, exc_info=True)
        except redis.ConnectionError as e:
            logger.warning("Redis connection error, retrying in 5 seconds: %s", e)
            time.sleep(5)
        except Exception as e:
            if not running:
                break
            logger.error("Error in consumer loop: %s", e, exc_info=True)
            time.sleep(1)

    logger.info("Worker shutting down.")


if __name__ == "__main__":
    main()
