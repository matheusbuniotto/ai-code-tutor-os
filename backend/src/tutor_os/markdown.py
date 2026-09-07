"""Section-scoped editing for the Markdown docs agents keep as memory."""

from __future__ import annotations

import re


def replace_section(body: str, header: str, content: str) -> str:
    """Replaces the `## header` section with `content`, appending it if absent.

    Matches on the header prefix so a decorated heading (e.g. a profile tag
    appended to the title) still resolves to the same section.
    """
    pattern = re.compile(rf"{re.escape(header)}[^\n]*\n[\s\S]*?(?=\n## |$)")
    section = f"{header}\n{content}\n"
    if pattern.search(body):
        # lambda, not a template string: content is agent-authored and may contain \1, \g...
        return pattern.sub(lambda _: section, body, count=1)
    return f"{body}\n{section}"
