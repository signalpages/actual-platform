# Field Notes Content Ops Workflow

This document outlines the repeatable workflow for generating and syncing qualitative Field Notes.

## 1. Gemini Gem Setup
Construct a new Gemini Gem using these instructions:

### System Instructions (Copy/Paste)
```text
You generate “Field Notes” for Actual.fyi product pages.
Return valid JSON ONLY. No markdown. No commentary.
Use ONLY information and URLs present in the attached notebook sources. Do not invent sources.
Write in calm, neutral, observational tone.
Do not use direct quotes. Do not include usernames.
Do not state speculation as fact. Use “reports of…” where appropriate.
Do not mention NotebookLM, Gemini, or AI.
Do not provide verdicts or scores.
Output must follow this schema and caps:

source_urls: all URLs used (max 20)
sources: array of { title, url, type: 'owner' | 'reference' } (max 20)
praise: max 10 bullets
friction: max 10 bullets
themes: max 10 bullets
Always include product_slug.
```

## 2. Batch Generation Prompt (Copy/Paste)
You can generate notes for multiple products in one go:

```text
Generate Field Notes for the following products:
1. <SLUG_1>
2. <SLUG_2>

Output a JSON ARRAY of snapshot objects.
Ensure source_count equals sources length.
Keep tone neutral and observational.
```

## 3. JSON Contract Schema (Batch)
Gem output should be a JSON array:

```json
[
  {
    "product_slug": "product-1",
    "sources": [{ "title": "...", "url": "...", "type": "owner" }],
    "praise": ["..."],
    "friction": ["..."],
    "themes": ["..."]
  },
  {
    "product_slug": "product-2",
    "sources": [{ "title": "...", "url": "...", "type": "reference" }],
    "praise": ["..."],
    "friction": ["..."],
    "themes": ["..."]
  }
]
```

## 4. Seeding Procedure
The "Field Notes" tab appears automatically for any product that has a record in the database. No manual allowlist update is required.

### Sync Command
Save your JSON to a temporary file (e.g., `tmp/notes_batch.json`) and run:

```bash
npx ts-node scripts/importFieldNotes.ts --path tmp/notes_batch.json
```

To sync all existing files in the `seeds/field_notes` directory:
```bash
npx ts-node scripts/importFieldNotes.ts --dir seeds/field_notes
```

## 5. Pre-Sync Validation Checklist
- [ ] Output is valid JSON (no trailing commas)
- [ ] `product_slug` matches the database slug exactly
- [ ] `sources` contains `type: 'owner'` for Reddit/Forums and `type: 'reference'` for reviews/docs.
- [ ] Bullets comply with hard caps (max 10)
- [ ] No “marketing language” / no “best-in-class”
- [ ] No direct quotes / no usernames
```
