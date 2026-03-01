# Field Notes Content Ops Workflow

This document outlines the repeatable manual workflow for generating and seeding qualitative Field Notes for Actual.fyi.

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
sources: array of { title, url } (max 20)
praise: max 10 bullets
friction: max 10 bullets
themes: max 10 bullets
Always include product_slug.
```

## 2. One-Shot Prompt Template (Copy/Paste)
Use this prompt when generating a specific snapshot:

```text
Generate Field Notes for product_slug = <SLUG>.
Output JSON only using the required schema.
Include:
sources (array of objects with "title" and "url")
praise (max 10)
friction (max 10)
themes (max 10)
Ensure source_count equals sources length.
Keep tone neutral and observational.
```

## 3. JSON Contract Schema (Strict)
Gem output must be valid JSON:

```json
{
  "product_slug": "example-slug",
  "source_urls": ["https://..."],
  "source_count": 5,
  "praise": [
    "Resilient build quality",
    "Silent operation"
  ],
  "friction": [
    "Heavy weight",
    "Slow app connectivity"
  ],
  "themes": [
    "Home backup",
    "Off-grid living"
  ],
  "delta_summary": [
    "Firmware v2 improved fan control"
  ]
}
```

## 4. Pre-Seed Validation Checklist
- [ ] Output is valid JSON (no trailing commas)
- [ ] `product_slug` matches allowlist slug exactly
- [ ] `source_urls` contains only real URLs present in notebook
- [ ] `source_count` === `source_urls.length`
- [ ] Bullets comply with hard caps
- [ ] No “marketing language” / no “best-in-class”
- [ ] No direct quotes / no usernames
- [ ] No statements that sound like audit verdicts

## 5. Seeding Procedure
1. Save the JSON output to `seeds/field_notes/<product_slug>.json`.
2. Run the seeding script:
   ```bash
   npx ts-node scripts/seedFieldNotes.ts
   ```
   *The script automatically looks up `product_id` and computes a deterministic `snapshot_hash`.*
