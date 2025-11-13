"""
Comprehensive retry logic with exponential backoff and jitter.

Handles various error types including:
- Rate limits (429)
- Server errors (500, 502, 503, 504)
- Service overload (529)
- Network errors
- Timeouts
"""

import time
import random
import logging
from typing import Callable, TypeVar, Set
from anthropic import APIError, APIConnectionError, APITimeoutError, RateLimitError

logger = logging.getLogger(__name__)

T = TypeVar('T')


class RetryConfig:
    """Configuration for retry behavior"""

    def __init__(
        self,
        max_attempts: int = 5,
        initial_delay: float = 2.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True
    ):
        self.max_attempts = max_attempts
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter

        # HTTP status codes that should trigger retry
        self.retryable_status_codes: Set[int] = {
            429,  # Rate limit
            500,  # Internal server error
            502,  # Bad gateway
            503,  # Service unavailable
            504,  # Gateway timeout
            529,  # Service overload (Anthropic specific)
        }


class RetryHandler:
    """
    Comprehensive retry logic with exponential backoff and jitter.

    Features:
    - Handles multiple error types
    - Exponential backoff with configurable parameters
    - Jitter to prevent thundering herd
    - Special handling for rate limits (longer delays)
    - Detailed logging of all retry attempts
    """

    def __init__(self, config: RetryConfig = None):
        """
        Initialize retry handler.

        Args:
            config: Retry configuration. If None, uses defaults.
        """
        self.config = config or RetryConfig()

    def with_retry(
        self,
        func: Callable[[], T],
        operation_name: str = "API call"
    ) -> T:
        """
        Execute function with retry logic.

        Args:
            func: Function to execute (should return a value)
            operation_name: Name for logging purposes

        Returns:
            Result from successful function execution

        Raises:
            Last exception if all retries exhausted
        """
        last_exception = None

        for attempt in range(1, self.config.max_attempts + 1):
            try:
                logger.info(f"{operation_name}: Attempt {attempt}/{self.config.max_attempts}")
                result = func()

                if attempt > 1:
                    logger.info(f"{operation_name}: Succeeded after {attempt} attempts")

                return result

            except RateLimitError as e:
                last_exception = e
                if attempt < self.config.max_attempts:
                    # Rate limits need longer delays
                    delay = self._calculate_delay(attempt, 429)
                    logger.warning(
                        f"{operation_name}: Rate limit hit (429), "
                        f"retrying in {delay:.1f}s... Attempt {attempt}/{self.config.max_attempts}"
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        f"{operation_name}: Max retries exhausted due to rate limiting"
                    )

            except APIError as e:
                last_exception = e
                status_code = getattr(e, 'status_code', None)

                if status_code in self.config.retryable_status_codes:
                    if attempt < self.config.max_attempts:
                        delay = self._calculate_delay(attempt, status_code)
                        logger.warning(
                            f"{operation_name}: API error {status_code}, "
                            f"retrying in {delay:.1f}s... ({e})"
                        )
                        time.sleep(delay)
                    else:
                        logger.error(
                            f"{operation_name}: Max retries exhausted. "
                            f"Last error: {status_code} - {e}"
                        )
                else:
                    # Non-retryable API error
                    logger.error(
                        f"{operation_name}: Non-retryable API error {status_code}: {e}"
                    )
                    raise

            except (APIConnectionError, APITimeoutError) as e:
                last_exception = e

                if attempt < self.config.max_attempts:
                    delay = self._calculate_delay(attempt, None)
                    logger.warning(
                        f"{operation_name}: Network error, "
                        f"retrying in {delay:.1f}s... ({type(e).__name__}: {e})"
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        f"{operation_name}: Max retries exhausted due to network errors"
                    )

            except Exception as e:
                # Non-retryable errors (e.g., validation errors)
                logger.error(
                    f"{operation_name}: Non-retryable exception: {type(e).__name__}: {e}"
                )
                raise

        # All retries exhausted
        logger.error(
            f"{operation_name}: All {self.config.max_attempts} retry attempts failed"
        )
        raise last_exception

    def _calculate_delay(self, attempt: int, status_code: int = None) -> float:
        """
        Calculate backoff delay with exponential backoff and jitter.

        Args:
            attempt: Current attempt number (1-indexed)
            status_code: HTTP status code if available

        Returns:
            Delay in seconds
        """
        # Base exponential backoff: initial_delay * (base ^ (attempt - 1))
        delay = self.config.initial_delay * (
            self.config.exponential_base ** (attempt - 1)
        )

        # Cap at max delay
        delay = min(delay, self.config.max_delay)

        # Special handling for rate limits - use longer minimum delay
        if status_code == 429:
            delay = max(delay, 10.0)  # Minimum 10s for rate limits

        # Add jitter to prevent thundering herd problem
        # Jitter: random value between 0 and 10% of delay
        if self.config.jitter:
            jitter = random.uniform(0, delay * 0.1)
            delay += jitter

        return delay


# Global retry handler instance with default config
default_retry_handler = RetryHandler()


def with_retry(func: Callable[[], T], operation_name: str = "Operation") -> T:
    """
    Convenience function for retrying operations.

    Uses global default retry handler.

    Args:
        func: Function to execute
        operation_name: Name for logging

    Returns:
        Result from successful execution

    Example:
        result = with_retry(
            lambda: client.messages.create(...),
            operation_name="Convert document"
        )
    """
    return default_retry_handler.with_retry(func, operation_name)


# Context manager for custom retry config
class retry_context:
    """
    Context manager for temporary retry configuration.

    Example:
        with retry_context(max_attempts=3, initial_delay=1.0):
            result = with_retry(lambda: api_call())
    """

    def __init__(self, **config_kwargs):
        self.config_kwargs = config_kwargs
        self.old_handler = None

    def __enter__(self):
        global default_retry_handler
        self.old_handler = default_retry_handler
        default_retry_handler = RetryHandler(RetryConfig(**self.config_kwargs))
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        global default_retry_handler
        default_retry_handler = self.old_handler
