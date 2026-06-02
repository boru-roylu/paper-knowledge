---
name: paper-knowledge-ingest
description: Use this skill when the user asks to add, ingest, read, summarize, or analyze a research paper for the Paper Knowledge site from arXiv, ACL Anthology, OpenReview, NeurIPS, conference pages, PDFs, paper URLs, GitHub repos associated with papers, or paper metadata. This skill prioritizes arXiv TeX source, discovers GitHub and OpenReview context, and writes Chinese Markdown summaries plus metadata in the existing paper-knowledge format.
---

# Paper Knowledge Ingest

Use this workflow to add a paper to `/home/codex/paper-knowledge` and publish it in the existing Quartz Paper Knowledge format.

## Operating Rules

- Work in `/home/codex/paper-knowledge` unless the user explicitly says otherwise.
- Preserve Traditional Chinese summary text, but keep technical terms in English.
- Prefer existing repo scripts over hand-written one-off logic.
- Prefer arXiv TeX source over PDF text.
- Do not treat GitHub repos, blogs, or tool pages as formal papers. Add them under `content/tools/<tool_key>/` unless the user explicitly asks for a paper page.
- For a paper page, produce both:
  - `content/papers/<paper_key>/index.md`
  - `content/papers/<paper_key>/metadata.json`
- After content changes, run `npm run build:papers`.
- Publish only from `main` using `npm run paper:publish -- --no-build --message "<message>"`.
- If running from Telegram, keep replies short and mention the generated page path plus any unresolved issues.

## Preferred Pipeline

1. **Normalize input**
   - Extract all paper-like URLs from the user request.
   - For arXiv `abs`, `pdf`, or `src`, normalize to `https://arxiv.org/abs/<id>`.
   - Use paper key `arxiv_<id with dot replaced by underscore>` for arXiv papers.
   - Use PST date for `created`.

2. **Fetch arXiv metadata and TeX**
   - For arXiv papers, download `https://arxiv.org/src/<id>` into cache if not present.
   - Unpack TeX source under repo cache.
   - Locate the main entrypoint using existing script helpers when available.
   - Read relevant `.tex`, `.bbl`, and `.bib` files. Follow `\input{}` / `\include{}` recursively when needed.
   - Use PDF only as fallback when TeX source is unavailable or unusable.

3. **Find GitHub / code links**
   - Search in this order:
     - paper abstract / arXiv HTML metadata
     - TeX source and bibliography
     - paper PDF text if needed
     - official project page
     - web search
   - Prefer official author/project GitHub links over third-party repos.
   - Add discovered code links to the `Links` section and to metadata `urls.repo` or `urls.code` when appropriate.

4. **Find OpenReview / review context**
   - Search for an OpenReview page matching the paper title and first author.
   - If found, fetch reviews, author responses, decision, and forum metadata.
   - Summarize reviewer concerns in Chinese, grounded in the paper content.
   - When summarizing OpenReview, re-check the TeX/source content for the criticized method, experiment, or limitation. Do not summarize reviews in isolation.
   - If no public OpenReview page is found, write: `未找到公開 OpenReview review/rebuttal context。`

5. **Generate the paper page**
   - Follow the current page shape:
     - frontmatter
     - Papers nav
     - generation note with summary model
     - `## Links`
     - `## 一句話總結`
     - `## 這篇在解決什麼問題`
     - `## 核心方法`
     - `## Training / Data`
     - `## 主要結果`
     - `## Project relevance`
     - `## Related papers in my pool`
     - `## OpenReview / reviewer discussion`
     - `## 我該不該細讀`
     - `## 可能的弱點 / open questions`
     - `## Tags`
     - `## Concepts`
     - `## Citation`
   - Put citation/BibTeX near the bottom.
   - Do not include the citation graph inside individual paper pages.

6. **Generate metadata**
   - Include at least:
     - `paper_key`
     - `canonical_id`
     - `arxiv_id` if available
     - `title`
     - `authors`
     - `venue`
     - `year`
     - `abstract`
     - `urls.abs`, `urls.pdf`, `urls.source`
     - `urls.repo` or `urls.code` if found
     - `tags`
     - `concepts`
     - `status`
     - `created`
     - `publication_status`
     - `bibtex_key`
     - `fetch_source`
     - `summary_model`
     - `citations`
   - Use accurate arXiv year from arXiv metadata, not ingestion year.

7. **Update site indexes and graph**
   - Run:
     ```bash
     npm run build:papers
     ```
   - This should regenerate:
     - homepage
     - tag routes
     - citation graph
   - Citation graph should use paper-to-paper citation edges when references match known pool papers.

8. **Publish**
   - Ensure current branch is `main`.
   - Run:
     ```bash
     npm run paper:publish -- --no-build --message "Add <short paper title>"
     ```

## Existing Repo Scripts To Prefer

Use these before custom logic:

```bash
npm run paper:ingest -- <url>
npm run paper:ingest-summary -- <url>
npm run paper:openreview -- <paper_key_or_url>
npm run paper:openreview-summary -- <paper_key_or_url>
npm run citation:sync
npm run build:papers
npm run paper:publish -- --no-build --message "<message>"
```

If the exact npm script arguments are unclear, inspect the corresponding file under `scripts/` before running.

Important scripts:

- `scripts/paper-common.mjs`
- `scripts/paper-fetch-ingest.mjs`
- `scripts/summarize-paper.mjs`
- `scripts/fetch-openreview-notes.mjs`
- `scripts/summarize-openreview-notes.mjs`
- `scripts/update-citation-graph.mjs`
- `scripts/update-index.mjs`
- `scripts/publish-paper-site.mjs`

## Model Guidance

- Triage / metadata / deterministic routing can use a smaller model.
- Full paper summary should use a stronger model when available.
- OpenReview synthesis should use a stronger model because it must compare reviews against the paper.
- Always write the model used in the page generation note and `metadata.json`.

## Quality Checks

Before publishing, verify:

- `index.md` has only one title/header area and no duplicate title section.
- Links include original URL and arXiv URL when available.
- No empty PDF links.
- `created` uses PST date.
- year is publication/arXiv year, not ingestion year.
- tags are short and meaningful.
- project tags use hyphenated slugs, not slashes.
- `npm run build:papers` succeeds.
- `git status --short` only shows intended changes before publishing.

## Failure Handling

- If arXiv TeX is unavailable, record that in metadata quality warnings and use PDF / abstract fallback.
- If GitHub is not found, explicitly say no official code repo was found.
- If OpenReview is not found, explicitly say no public OpenReview context was found.
- If a URL is a repo/blog/tool rather than a paper, create a `content/tools/<tool_key>/` note instead of a paper page.
