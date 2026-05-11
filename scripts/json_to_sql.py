#!/usr/bin/env python3
"""
Convert sentences.json to SQL INSERT statements for D1 import.
Usage: python json_to_sql.py sentences.json > import.sql
"""

import json
import sys
import hashlib
import time
import random

def generate_id(jp, en):
    """Generate a deterministic ID based on sentence content."""
    # Use jp+en content to generate a consistent hash
    # Same sentence will always get the same ID -> prevents duplicates
    unique_str = jp + "|" + en
    return hashlib.md5(unique_str.encode()).hexdigest()[:12]

def escape_sql(text):
    """Escape single quotes for SQL."""
    return text.replace("'", "''")

def main():
    if len(sys.argv) != 2:
        print("Usage: python json_to_sql.py sentences.json", file=sys.stderr)
        sys.exit(1)

    input_file = sys.argv[1]

    with open(input_file, 'r', encoding='utf-8') as f:
        sentences = json.load(f)

    print("-- Generated SQL INSERT statements")
    print("-- Total sentences:", len(sentences))
    print()

    # Use INSERT OR IGNORE to avoid duplicates
    for sentence in sentences:
        jp_raw = sentence['jp']
        en_raw = sentence['en']
        sentence_id = generate_id(jp_raw, en_raw)
        jp = escape_sql(jp_raw)
        en = escape_sql(en_raw)
        source = escape_sql(sentence.get('source', ''))
        created_at = int(time.time() * 1000)

        print(f"INSERT OR IGNORE INTO sentences (id, video_id, source, jp, en, created_at)")
        print(f"VALUES ('{sentence_id}', NULL, '{source}', '{jp}', '{en}', {created_at});")

    print()
    print(f"-- Total: {len(sentences)} sentences")

if __name__ == '__main__':
    main()
