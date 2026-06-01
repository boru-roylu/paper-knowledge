import fs from "node:fs"
import path from "node:path"
import { PAPERS, yamlString, shortTags, writeJson, listFiles } from "./paper-common.mjs"

const key = process.argv[2]
if (!key) throw new Error("Usage: node scripts/summarize-paper.mjs <paper_key>")
const model = process.env.PAPER_SUMMARY_MODEL || "gpt-5.4-mini"
const paperDir = path.join(PAPERS, key)
const metaPath = path.join(paperDir, "metadata.json")
if (!fs.existsSync(metaPath)) throw new Error(`missing ${metaPath}`)
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"))
const indexPath = path.join(paperDir, "index.md")
const existingIndexRead = fs.existsSync(indexPath) && /^status:\s*read\s*$/m.test(fs.readFileSync(indexPath, "utf8"))

function loadGatewayEnv() {
  const envPath = path.join(process.env.HOME || "/home/openclaw", ".config/openclaw/gateway.env")
  if (!process.env.OPENAI_API_KEY && fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^OPENAI_API_KEY=(.*)$/)
      if (m) process.env.OPENAI_API_KEY = m[1].replace(/^"|"$/g, "")
    }
  }
}

function readTexContext() {
  const sourceDir = path.join(paperDir, meta.local_paths?.source_dir || "source")
  const entry = meta.local_paths?.entrypoint ? path.join(paperDir, meta.local_paths.entrypoint) : null
  const files = []
  if (entry && fs.existsSync(entry)) files.push(entry)
  for (const f of listFiles(sourceDir).filter((p) => p.endsWith(".tex"))) if (!files.includes(f)) files.push(f)
  let text = files.slice(0, 6).map((f) => fs.readFileSync(f, "utf8")).join("\n\n")
  text = text.replace(/^%.*$/gm, "")
  const titleBlock = text.slice(0, 18000)
  const sectionLines = [...text.matchAll(/\\(?:sub)*section\*?\{([^}]+)\}/g)].map((m) => m[0]).join("\n")
  const conclusion = text.match(/\\section\*?\{(?:Conclusion|Conclusions|Discussion|Limitations|Challenges and Future Directions)[^}]*\}([\s\S]{0,12000})/i)?.[0] || ""
  const tex = `${titleBlock}\n\nSECTION OUTLINE:\n${sectionLines}\n\nCONCLUSION-LIKE EXCERPT:\n${conclusion}`.slice(0, 36000)
  if (tex.trim()) return tex
  if (meta.local_paths?.paper_fetch_markdown) {
    const pf = path.resolve(paperDir, meta.local_paths.paper_fetch_markdown)
    if (fs.existsSync(pf)) return fs.readFileSync(pf, "utf8").slice(0, 36000)
  }
  return ""
}

const paperNav = '<div class="paper-nav"><a href="../../">&larr; Papers</a></div>\n\n'

function generationNote(meta) {
  const rows = []
  if (meta.summary_model) rows.push(`- Paper summary model: \`${meta.summary_model}\``)
  if (meta.openreview?.summary_model) rows.push(`- OpenReview summary model: \`${meta.openreview.summary_model}\``)
  if (!rows.length) return ""
  return `<div class="generation-note">\n\n${rows.join("\n")}\n\n</div>\n\n`
}

function frontmatter(meta, tags) {
  return [
    "---",
    `paper_key: ${meta.paper_key}`,
    `canonical_id: ${yamlString(meta.canonical_id)}`,
    `title: ${yamlString(meta.title)}`,
    `year: ${meta.year}`,
    `venue: ${yamlString(meta.venue)}`,
    `url: ${yamlString(meta.urls.abs)}`,
    `pdf_url: ${yamlString(meta.urls.pdf)}`,
    "status: read",
    "rating: 4",
    "tags:",
    ...tags.map((t) => `  - ${t}`),
    `created: ${meta.created}`,
    "---",
    "",
  ].join("\n")
}

function fallbackSummary(meta, tags) {
  return frontmatter(meta, tags) + paperNav + generationNote(meta) + [
    "## Links", "",
    `- [arXiv abstract](${meta.urls.abs})`,
    `- [PDF](${meta.urls.pdf})`, "",
    "## 一句話總結", "",
    `${meta.title}：${meta.abstract}`, "",
    "## Status", "",
    "Summary model failed or was skipped; this page contains deterministic metadata and abstract only.", "",
    "## Citation", "",
    "目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。", "",
    "```bibtex",
    `@misc{${meta.bibtex_key},`,
    `  title={${meta.title}},`,
    `  author={${meta.authors.join(" and ")}},`,
    `  year={${meta.year}},`,
    `  eprint={${meta.arxiv_id}},`,
    "  archivePrefix={arXiv},",
    meta.primaryClass ? `  primaryClass={${meta.primaryClass}},` : "",
    `  doi={10.48550/arXiv.${meta.arxiv_id}}`,
    "}",
    "```", "",
  ].filter((line) => line !== "").join("\n")
}

function relatedPaperContext() {
  const myTags = new Set(meta.tags || [])
  const rows = []
  for (const dir of fs.readdirSync(PAPERS, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name === key) continue
    const mpath = path.join(PAPERS, dir.name, "metadata.json")
    const ipath = path.join(PAPERS, dir.name, "index.md")
    if (!fs.existsSync(mpath) || !fs.existsSync(ipath)) continue
    const other = JSON.parse(fs.readFileSync(mpath, "utf8"))
    const overlap = (other.tags || []).filter((tag) => myTags.has(tag))
    if (!overlap.some((tag) => tag.startsWith("project-")) && overlap.length < 2) continue
    const summary = fs.readFileSync(ipath, "utf8")
      .replace(/^---[\s\S]*?---/, "")
      .replace(/## Citation[\s\S]*$/i, "")
      .slice(0, 1400)
    rows.push({ score: overlap.length, title: other.title, year: other.year, tags: overlap, summary })
  }
  return rows
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((row) => `- ${row.title} (${row.year}); shared tags: ${row.tags.join(", ")}\n${row.summary}`)
    .join("\n\n")
}

function reviewContext() {
  const p = meta.openreview?.local_path ? path.join(paperDir, meta.openreview.local_path) : ""
  if (p && fs.existsSync(p)) return fs.readFileSync(p, "utf8").slice(0, 12000)
  return ""
}

function prompt(meta, tex, related, reviews) {
  return `你是研究助理。請根據下面 metadata、abstract、TeX excerpts，產生一份 Traditional Chinese paper summary。保留 technical terms in English。不要輸出 top-level # title。只輸出 Markdown body，從 ## Links 開始，最後一定要有 ## Citation。

Sections 必須包含：
## Links
## 一句話總結
## 這篇在解決什麼問題
## 核心方法
## Training / Data
## 主要結果
## Project relevance
## Related papers in my pool
## OpenReview / reviewer discussion
## 我該不該細讀
## 可能的弱點 / open questions
## Tags
## Concepts
## Citation

Project relevance 只做短分類，不要長 brainstorming。兩個 project：
- project-full-duplex-data: better full-duplex models/data from mono-channel dialogue, speaker separation, overlap/backchannel synthesis, dual-channel conversation generation.
- project-tts-data-pipeline: English TTS data cleaning, overlap detection, transcription quality, filtering, data pipeline.

Related papers in my pool 只根據下面提供的 existing summaries，比較方法、資料、任務設定或 limitation；如果沒有相關內容，就寫「目前 pool 裡沒有明顯直接相關的已讀 paper」。

OpenReview / reviewer discussion 只根據下面提供的 OpenReview context；如果沒有，就寫「未找到公開 OpenReview review/rebuttal context」。如果有 reviewer discussion，重點整理 reviewers 指出的 weaknesses、authors rebuttal 的回應、以及這些 criticism 對讀 paper 的影響。

Links 必須包含：
- [arXiv abstract](${meta.urls.abs})
- [PDF](${meta.urls.pdf})

Citation 用這個 BibTeX key: ${meta.bibtex_key}

Metadata:
${JSON.stringify({ title: meta.title, authors: meta.authors, year: meta.year, venue: meta.venue, abstract: meta.abstract, arxiv_id: meta.arxiv_id, primaryClass: meta.primaryClass, categories: meta.categories }, null, 2)}

Existing related summaries:
${related || "(none)"}

OpenReview context:
${reviews || "(none)"}

TeX excerpts:
${tex}`
}

async function callOpenAI(input) {
  loadGatewayEnv()
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not available")
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, input, max_output_tokens: 2600 }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${body.slice(0, 500)}`)
  const json = JSON.parse(body)
  if (json.output_text) return json.output_text
  const texts = []
  for (const item of json.output || []) for (const c of item.content || []) if (c.text) texts.push(c.text)
  return texts.join("\n").trim()
}

function addDeterministicLinks(body) {
  if (!meta.openreview?.summary_local_path || !body.includes("## OpenReview / reviewer discussion")) return body
  const link = `- [OpenReview summary](./${meta.openreview.summary_local_path.replace(/\.md$/, "/")})`
  if (body.includes(link)) return body
  return body.replace(
    "## OpenReview / reviewer discussion",
    `## OpenReview / reviewer discussion\n${link}`,
  )
}

const tags = Array.isArray(meta.tags) && meta.tags.length ? meta.tags : shortTags(meta)
let body
try {
  body = await callOpenAI(prompt(meta, readTexContext(), relatedPaperContext(), reviewContext()))
  body = addDeterministicLinks(body)
  if (!body.includes("## Citation")) throw new Error("model output missing Citation")
} catch (err) {
  console.error(`summary failed for ${key}: ${err.message || err}`)
  if (!existingIndexRead) fs.writeFileSync(indexPath, fallbackSummary(meta, tags))
  process.exitCode = 2
}

if (body) {
  meta.status = "read"
  meta.summary_model = model
  fs.writeFileSync(indexPath, frontmatter(meta, tags) + paperNav + generationNote(meta) + body.trim() + "\n")
  writeJson(metaPath, meta)
  console.log(`summarized ${key} with ${model}`)
}
