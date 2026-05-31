import fs from "node:fs"
import path from "node:path"
import { PAPERS, yamlString, shortTags, writeJson, listFiles } from "./paper-common.mjs"

const key = process.argv[2]
if (!key) throw new Error("Usage: node scripts/summarize-paper.mjs <paper_key>")
const model = process.env.PAPER_SUMMARY_MODEL || "gpt-5.4-nano"
const paperDir = path.join(PAPERS, key)
const metaPath = path.join(paperDir, "metadata.json")
if (!fs.existsSync(metaPath)) throw new Error(`missing ${metaPath}`)
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"))

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
  if (meta.local_paths?.paper_fetch_markdown) {
    const pf = path.resolve(paperDir, meta.local_paths.paper_fetch_markdown)
    if (fs.existsSync(pf)) return fs.readFileSync(pf, "utf8").slice(0, 52000)
  }
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
  return `${titleBlock}\n\nSECTION OUTLINE:\n${sectionLines}\n\nCONCLUSION-LIKE EXCERPT:\n${conclusion}`.slice(0, 52000)
}

const paperNav = '<div class="paper-nav"><a href="../../">&larr; Papers</a></div>\n\n'

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
  return frontmatter(meta, tags) + paperNav + [
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

function prompt(meta, tex) {
  return `你是研究助理。請根據下面 metadata、abstract、TeX excerpts，產生一份 Traditional Chinese paper summary。保留 technical terms in English。不要輸出 top-level # title。只輸出 Markdown body，從 ## Links 開始，最後一定要有 ## Citation。\n\nSections 必須包含：\n## Links\n## 一句話總結\n## 這篇在解決什麼問題\n## 核心方法\n## Training / Data\n## 主要結果\n## Project relevance\n## 我該不該細讀\n## 可能的弱點 / open questions\n## Tags\n## Concepts\n## Citation\n\nProject relevance 只做短分類，不要長 brainstorming。兩個 project：\n- project-full-duplex-data: better full-duplex models/data from mono-channel dialogue, speaker separation, overlap/backchannel synthesis, dual-channel conversation generation.\n- project-tts-data-pipeline: English TTS data cleaning, overlap detection, transcription quality, filtering, data pipeline.\n\nLinks 必須包含：\n- [arXiv abstract](${meta.urls.abs})\n- [PDF](${meta.urls.pdf})\n\nCitation 用這個 BibTeX key: ${meta.bibtex_key}\n\nMetadata:\n${JSON.stringify({ title: meta.title, authors: meta.authors, year: meta.year, venue: meta.venue, abstract: meta.abstract, arxiv_id: meta.arxiv_id, primaryClass: meta.primaryClass, categories: meta.categories }, null, 2)}\n\nTeX excerpts:\n${tex}`
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

const tags = Array.isArray(meta.tags) && meta.tags.length ? meta.tags : shortTags(meta)
let body
try {
  body = await callOpenAI(prompt(meta, readTexContext()))
  if (!body.includes("## Citation")) throw new Error("model output missing Citation")
} catch (err) {
  console.error(`summary failed for ${key}: ${err.message || err}`)
  fs.writeFileSync(path.join(paperDir, "index.md"), fallbackSummary(meta, tags))
  process.exitCode = 2
}

if (body) {
  fs.writeFileSync(path.join(paperDir, "index.md"), frontmatter(meta, tags) + paperNav + body.trim() + "\n")
  meta.status = "read"
  meta.summary_model = model
  writeJson(metaPath, meta)
  console.log(`summarized ${key} with ${model}`)
}
