"""
Multi-strategy file ID extraction with comprehensive fallbacks.

Prevents breakage when Anthropic API response structure changes.

Extraction strategies (in priority order):
1. Bash execution result objects (primary expected format)
2. Text content regex patterns (fallback)
3. Response metadata/attributes (fallback)
4. Deep content inspection (last resort)
"""

import re
import logging
from typing import List, Optional, Any
from anthropic.types import Message

logger = logging.getLogger(__name__)


class FileExtractionError(Exception):
    """Raised when all file extraction strategies fail"""
    pass


class FileExtractor:
    """
    Multi-strategy file ID extraction with comprehensive fallbacks.

    Tries multiple methods to extract file IDs from API response.
    Logs detailed information when extraction fails for debugging.
    """

    def __init__(self):
        self.file_id_pattern = re.compile(r'file-[a-zA-Z0-9_-]{20,}')

    def extract_file_ids(self, response: Message) -> List[str]:
        """
        Extract file IDs using multiple strategies.

        Strategies (in order):
        1. Bash execution result objects
        2. Text content regex patterns
        3. Response metadata
        4. Content inspection

        Args:
            response: Anthropic API response

        Returns:
            List of file IDs found

        Raises:
            FileExtractionError: If all strategies fail
        """
        strategies = [
            ("Bash Execution Result", self._extract_from_bash_result),
            ("Text Pattern Matching", self._extract_from_text_patterns),
            ("Response Metadata", self._extract_from_metadata),
            ("Deep Content Inspection", self._extract_from_content_inspection)
        ]

        for strategy_name, strategy_func in strategies:
            try:
                file_ids = strategy_func(response)
                if file_ids:
                    logger.info(
                        f"File extraction succeeded using strategy: {strategy_name} "
                        f"(found {len(file_ids)} file(s))"
                    )
                    return file_ids
            except Exception as e:
                logger.warning(f"Strategy '{strategy_name}' failed: {e}")
                continue

        # All strategies failed - provide detailed error
        self._log_response_structure(response)
        raise FileExtractionError(
            "Failed to extract file IDs from response using all strategies. "
            "This may indicate an API response format change. "
            "Check logs for response structure details."
        )

    def _extract_from_bash_result(self, response: Message) -> List[str]:
        """
        Strategy 1: Extract from code execution tool use (official Anthropic format).

        Expected structure per official docs:
        response.content[*].type == 'tool_use' AND .name == 'code_execution'
            .content[*].file_id

        Also supports legacy format:
        response.content[*].type == 'bash_code_execution_tool_result'
        """
        file_ids = []

        for content_block in response.content:
            # NEW: Official Anthropic format (tool_use with code_execution)
            if hasattr(content_block, 'type') and content_block.type == 'tool_use':
                if hasattr(content_block, 'name') and content_block.name == 'code_execution':
                    if hasattr(content_block, 'content'):
                        content_items = content_block.content
                        if not isinstance(content_items, list):
                            content_items = [content_items]

                        for item in content_items:
                            if hasattr(item, 'file_id'):
                                file_ids.append(item.file_id)
                                logger.debug(f"Found file_id (tool_use format): {item.file_id}")

            # LEGACY: Old format (keep for backwards compatibility)
            elif hasattr(content_block, 'type') and \
               content_block.type == 'bash_code_execution_tool_result':

                # Navigate nested structure defensively
                if hasattr(content_block, 'content'):
                    inner_content = content_block.content

                    if hasattr(inner_content, 'type') and \
                       inner_content.type == 'bash_code_execution_result':

                        if hasattr(inner_content, 'content'):
                            # Content can be a list of file objects
                            content_items = inner_content.content
                            if not isinstance(content_items, list):
                                content_items = [content_items]

                            for file_obj in content_items:
                                if hasattr(file_obj, 'file_id'):
                                    file_ids.append(file_obj.file_id)
                                    logger.debug(f"Found file_id (legacy format): {file_obj.file_id}")

        return file_ids

    def _extract_from_text_patterns(self, response: Message) -> List[str]:
        """
        Strategy 2: Extract file IDs from text content using regex.

        Looks for patterns like 'file-abc123xyz...' in text responses.
        """
        file_ids = []

        for content_block in response.content:
            if hasattr(content_block, 'type') and content_block.type == 'text':
                if hasattr(content_block, 'text'):
                    matches = self.file_id_pattern.findall(content_block.text)
                    file_ids.extend(matches)
                    if matches:
                        logger.debug(f"Found file IDs in text: {matches}")

        # Deduplicate while preserving order
        seen = set()
        unique_ids = []
        for file_id in file_ids:
            if file_id not in seen:
                seen.add(file_id)
                unique_ids.append(file_id)

        return unique_ids

    def _extract_from_metadata(self, response: Message) -> List[str]:
        """
        Strategy 3: Extract from response metadata or file attributes.

        Checks for file information in response-level attributes.
        """
        file_ids = []

        # Check for files attribute
        if hasattr(response, 'files') and response.files:
            for file_obj in response.files:
                if hasattr(file_obj, 'id'):
                    file_ids.append(file_obj.id)
                    logger.debug(f"Found file in metadata: {file_obj.id}")
                elif hasattr(file_obj, 'file_id'):
                    file_ids.append(file_obj.file_id)
                    logger.debug(f"Found file in metadata: {file_obj.file_id}")

        return file_ids

    def _extract_from_content_inspection(self, response: Message) -> List[str]:
        """
        Strategy 4: Inspect all content blocks for any file references.

        Last resort - looks through all attributes for file-like IDs.
        Uses recursive inspection.
        """
        file_ids = []

        def inspect_object(obj: Any, path: str = "", depth: int = 0):
            """Recursively inspect object for file IDs"""
            # Limit recursion depth to prevent infinite loops
            if depth > 10:
                return

            # Check if string matches file ID pattern
            if isinstance(obj, str):
                if self.file_id_pattern.match(obj):
                    file_ids.append(obj)
                    logger.debug(f"Found file ID at {path}: {obj}")

            # Recurse into lists
            elif isinstance(obj, (list, tuple)):
                for i, item in enumerate(obj):
                    inspect_object(item, f"{path}[{i}]", depth + 1)

            # Recurse into dicts
            elif isinstance(obj, dict):
                for key, value in obj.items():
                    inspect_object(value, f"{path}.{key}", depth + 1)

            # Recurse into objects with __dict__
            elif hasattr(obj, '__dict__'):
                for key, value in obj.__dict__.items():
                    # Skip private attributes and callables
                    if not key.startswith('_') and not callable(value):
                        inspect_object(value, f"{path}.{key}", depth + 1)

        # Start inspection from content
        if hasattr(response, 'content'):
            inspect_object(response.content, "response.content")

        return file_ids

    def _log_response_structure(self, response: Message):
        """
        Log detailed response structure for debugging.

        Called when all extraction strategies fail.
        """
        logger.error("=" * 80)
        logger.error("FILE EXTRACTION FAILED - Response Structure Analysis:")
        logger.error("=" * 80)

        # Log response type
        logger.error(f"Response type: {type(response)}")
        logger.error(f"Response class: {response.__class__.__name__}")

        # Log available attributes
        attrs = [attr for attr in dir(response) if not attr.startswith('_')]
        logger.error(f"Available attributes: {attrs}")

        # Log content blocks
        if hasattr(response, 'content'):
            logger.error(f"\nContent blocks (count: {len(response.content)}):")
            for i, block in enumerate(response.content):
                logger.error(f"\n  Block {i}:")
                logger.error(f"    Type: {getattr(block, 'type', 'NO TYPE ATTRIBUTE')}")

                block_attrs = [attr for attr in dir(block) if not attr.startswith('_')]
                logger.error(f"    Attributes: {block_attrs}")

                if hasattr(block, 'content'):
                    logger.error(f"    Has .content attribute:")
                    logger.error(f"      Content type: {type(block.content)}")
                    logger.error(f"      Content: {str(block.content)[:500]}...")  # First 500 chars

                if hasattr(block, 'text'):
                    logger.error(f"    Has .text attribute:")
                    logger.error(f"      Text (first 200 chars): {block.text[:200]}...")

        # Log usage info
        if hasattr(response, 'usage'):
            logger.error(f"\nToken usage:")
            logger.error(f"  Input tokens: {response.usage.input_tokens}")
            logger.error(f"  Output tokens: {response.usage.output_tokens}")
            if hasattr(response.usage, 'cache_read_input_tokens'):
                logger.error(f"  Cached tokens: {response.usage.cache_read_input_tokens}")

        # Log stop reason
        if hasattr(response, 'stop_reason'):
            logger.error(f"\nStop reason: {response.stop_reason}")

        logger.error("=" * 80)
        logger.error("Please report this issue with the above structure information")
        logger.error("=" * 80)


# Global file extractor instance
_file_extractor_instance: Optional[FileExtractor] = None


def get_file_extractor() -> FileExtractor:
    """Get or create global file extractor instance"""
    global _file_extractor_instance
    if _file_extractor_instance is None:
        _file_extractor_instance = FileExtractor()
    return _file_extractor_instance
