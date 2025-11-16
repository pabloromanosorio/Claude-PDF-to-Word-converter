"""
Cost calculation service for estimating and tracking conversion costs.
"""

from typing import Dict, Optional
from pypdf import PdfReader
from models import CostEstimate

# Token estimation constants
TOKENS_PER_PAGE_LOW = 1500  # Simple pages (mostly text)
TOKENS_PER_PAGE_HIGH = 3000  # Complex pages (tables, images)
TOKENS_PER_PAGE_AVG = 2250  # Average

OUTPUT_TOKENS_PER_PAGE_LOW = 2000
OUTPUT_TOKENS_PER_PAGE_HIGH = 4000
OUTPUT_TOKENS_PER_PAGE_AVG = 3000

# Model pricing per million tokens (input / output)
MODEL_PRICING = {
    'claude-haiku-4-5-20251001': {'input': 1.00, 'output': 5.00},
    'claude-sonnet-4-5-20250929': {'input': 3.00, 'output': 15.00}
}


class CostService:
    """Service for cost estimation and calculation"""

    def estimate_cost(
        self,
        page_count: int,
        model: str,
        page_range: Optional[str] = None
    ) -> CostEstimate:
        """
        Estimate cost before conversion.

        Args:
            page_count: Total pages in document
            model: Model to use
            page_range: Optional page range (e.g., "1-5, 7")

        Returns:
            CostEstimate with low/avg/high estimates
        """
        # If page range specified, calculate actual pages
        if page_range:
            pages_to_convert = len(self._parse_page_range(page_range))
        else:
            pages_to_convert = page_count

        # Get pricing
        pricing = MODEL_PRICING.get(model, MODEL_PRICING['claude-sonnet-4-5-20250929'])

        # Calculate estimates for three scenarios
        scenarios = [
            (TOKENS_PER_PAGE_LOW, OUTPUT_TOKENS_PER_PAGE_LOW),
            (TOKENS_PER_PAGE_AVG, OUTPUT_TOKENS_PER_PAGE_AVG),
            (TOKENS_PER_PAGE_HIGH, OUTPUT_TOKENS_PER_PAGE_HIGH)
        ]

        costs = []
        for input_per_page, output_per_page in scenarios:
            input_tokens = input_per_page * pages_to_convert
            output_tokens = output_per_page * pages_to_convert

            input_cost = (input_tokens / 1_000_000) * pricing['input']
            output_cost = (output_tokens / 1_000_000) * pricing['output']
            costs.append(input_cost + output_cost)

        return CostEstimate(
            page_count=pages_to_convert,
            estimated_cost_low=round(costs[0], 4),
            estimated_cost_avg=round(costs[1], 4),
            estimated_cost_high=round(costs[2], 4),
            model=model,
            notes=f"Estimates for {pages_to_convert} page(s) using {model.split('-')[1].capitalize()}"
        )

    def get_page_count(self, file_path: str) -> int:
        """
        Get page count from PDF.

        Args:
            file_path: Path to PDF file

        Returns:
            Number of pages

        Raises:
            ValueError: If not a PDF or cannot read
        """
        if not file_path.endswith('.pdf'):
            # Images count as 1 page
            return 1

        try:
            reader = PdfReader(file_path)
            return len(reader.pages)
        except Exception as e:
            raise ValueError(f"Failed to read PDF: {e}")

    def _parse_page_range(self, page_range: str) -> set:
        """
        Parse page range string into set of page numbers.

        Args:
            page_range: Range string like "1-5, 7, 9-12"

        Returns:
            Set of page numbers (1-indexed)
        """
        pages = set()
        for part in page_range.split(','):
            part = part.strip()
            if '-' in part:
                start, end = part.split('-')
                pages.update(range(int(start), int(end) + 1))
            else:
                pages.add(int(part))
        return pages


# Global service instance
_cost_service_instance: Optional[CostService] = None


def get_cost_service() -> CostService:
    """Get or create global cost service instance"""
    global _cost_service_instance
    if _cost_service_instance is None:
        _cost_service_instance = CostService()
    return _cost_service_instance
