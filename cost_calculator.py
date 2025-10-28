"""
Cost calculation for Claude API usage.
Handles both estimation (before conversion) and actual cost (after conversion).
"""

from typing import Dict
from pathlib import Path

# Pricing per million tokens (input/output)
MODEL_PRICING = {
    'claude-haiku-4-5-20251001': {'input': 1.00, 'output': 5.00},
    'claude-sonnet-4-5-20250929': {'input': 3.00, 'output': 15.00},
}

# Token estimation constants
TOKENS_PER_PAGE_LOW = 1500   # Simple pages (mostly text)
TOKENS_PER_PAGE_HIGH = 3000  # Complex pages (tables, images)
TOKENS_PER_PAGE_AVG = 2250   # Average

OUTPUT_TOKENS_PER_PAGE_LOW = 2000
OUTPUT_TOKENS_PER_PAGE_HIGH = 4000
OUTPUT_TOKENS_PER_PAGE_AVG = 3000


def get_pdf_page_count(file_path: str) -> int:
    """Get page count from PDF"""
    from pypdf import PdfReader
    reader = PdfReader(file_path)
    return len(reader.pages)


def estimate_cost_for_file(
    file_path: str,
    model: str,
    page_range: str = ''
) -> Dict[str, float]:
    """
    Estimate cost before conversion

    Returns:
        {
            'estimated_cost_low': float,
            'estimated_cost_high': float,
            'estimated_cost_avg': float,
            'page_count': int
        }
    """
    # Get page count
    if file_path.endswith('.pdf'):
        page_count = get_pdf_page_count(file_path)

        # If page range specified, count only selected pages
        if page_range:
            pages_to_convert = parse_page_range(page_range)
            page_count = len(pages_to_convert)
    else:
        # Images count as 1 page
        page_count = 1

    # Get pricing
    pricing = MODEL_PRICING.get(model, MODEL_PRICING['claude-sonnet-4-5-20250929'])

    # Calculate estimates (low, high, average)
    scenarios = [
        (TOKENS_PER_PAGE_LOW, OUTPUT_TOKENS_PER_PAGE_LOW),
        (TOKENS_PER_PAGE_HIGH, OUTPUT_TOKENS_PER_PAGE_HIGH),
        (TOKENS_PER_PAGE_AVG, OUTPUT_TOKENS_PER_PAGE_AVG)
    ]

    costs = []
    for input_per_page, output_per_page in scenarios:
        input_tokens = input_per_page * page_count
        output_tokens = output_per_page * page_count

        input_cost = (input_tokens / 1_000_000) * pricing['input']
        output_cost = (output_tokens / 1_000_000) * pricing['output']
        costs.append(input_cost + output_cost)

    return {
        'estimated_cost_low': round(costs[0], 4),
        'estimated_cost_high': round(costs[1], 4),
        'estimated_cost_avg': round(costs[2], 4),
        'page_count': page_count
    }


def calculate_actual_cost(usage: Dict[str, int], model: str) -> float:
    """
    Calculate actual cost after conversion

    Args:
        usage: {'input_tokens': int, 'output_tokens': int}
        model: Model name

    Returns:
        Cost in USD
    """
    pricing = MODEL_PRICING.get(model, MODEL_PRICING['claude-sonnet-4-5-20250929'])

    input_cost = (usage['input_tokens'] / 1_000_000) * pricing['input']
    output_cost = (usage['output_tokens'] / 1_000_000) * pricing['output']

    return round(input_cost + output_cost, 4)


def parse_page_range(page_range: str) -> set:
    """Parse page range string into set of page numbers"""
    pages = set()
    for part in page_range.split(','):
        part = part.strip()
        if '-' in part:
            start, end = part.split('-')
            pages.update(range(int(start), int(end) + 1))
        else:
            pages.add(int(part))
    return pages
