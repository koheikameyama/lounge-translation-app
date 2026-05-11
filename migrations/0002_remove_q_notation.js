#!/usr/bin/env node
/**
 * Migration: Remove Q○○ notation from Japanese text in database
 *
 * Removes patterns like Q01, Q001, Q１, Q○○, Q〇〇 from the beginning of jp column
 *
 * Usage:
 *   node migrations/0002_remove_q_notation.js
 *
 * This script will:
 * 1. Fetch all sentences from the production database
 * 2. Remove Q○○ patterns from Japanese text
 * 3. Update the database with cleaned text
 */

const API_BASE = process.env.API_BASE || 'https://lounge-translation-app.pages.dev';

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

function removeQNotation(text) {
  return text.replace(/^[Qq][0-9０-９○◯〇]+[\s:：]*/, '');
}

async function main() {
  console.log('Fetching all sentences...');
  const sentences = await fetchAPI('/api/sentences');
  console.log(`Found ${sentences.length} sentences`);

  let updateCount = 0;
  let unchangedCount = 0;

  for (const sentence of sentences) {
    const cleanedJp = removeQNotation(sentence.jp);

    if (cleanedJp !== sentence.jp) {
      console.log(`Updating: "${sentence.jp}" -> "${cleanedJp}"`);

      await fetchAPI('/api/sentences', {
        method: 'PUT',
        body: JSON.stringify({
          id: sentence.id,
          jp: cleanedJp,
          en: sentence.en,
          source: sentence.source,
        }),
      });

      updateCount++;
    } else {
      unchangedCount++;
    }
  }

  console.log(`\nMigration complete!`);
  console.log(`- Updated: ${updateCount} sentences`);
  console.log(`- Unchanged: ${unchangedCount} sentences`);
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
