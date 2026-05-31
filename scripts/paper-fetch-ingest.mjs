import fs from "node:fs"
import path from "node:path"
import {
  ROOT, PAPERS, CACHE,
  ensureDirs, parseArxivId, paperKeyFromArxiv, run, yamlString, shortTags, writeJson, todayPacific,
} from "./paper-common.mjs"

ensureDirs()
const args = process.argv.slice(2)
const url = args.includes("--url") ? args[args.indexOf("--url") + 1] : args.find((a) => /^https?:|doi:|10\./i.test(a))
if (!url) throw new Error("Usage: node scripts/paper-fetch-ingest.mjs --url <paper-url>")
const overwrite = args.includes("--overwrite")
const doSummarize = args.includes("--summarize")
const arxiv = parseArxivId(url)
const paperKey = arxiv ? paperKeyFromArxiv(arxiv.id) : `paper_${Date.now()}`
const paperDir = path.join(PAPERS, paperKey)
const existingMetaPath = path.join(paperDir, "metadata.json")
const existingMeta = fs.existsSync(existingMetaPath) ? JSON.parse(fs.readFileSync(existingMetaPath, "utf8")) : null
const existingIndexPath = path.join(paperDir, "index.md")
const existingIndexRead = fs.existsSync(existingIndexPath) && /^status:\s*read\s*$/m.test(fs.readFileSync(existingIndexPath, "utf8"))
const fetchDir = path.join(CACHE, "paper-fetch", paperKey)
fs.mkdirSync(paperDir, { recursive: true })
fs.mkdirSync(fetchDir, { recursive: true })


function findOutputJson() {
  const files = fs.readdirSync(fetchDir).filter((f) => f.endsWith(".both.json"))
  if (!files.length) return null
  return path.join(fetchDir, files.sort()[0])
}

function cleanAuthor(a) { return String(a || "").replace(/\*+$/g, "").trim() }

function inferTitleFromMarkdown(markdown) {
  const lines = String(markdown || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (line === "---" || /^[:#-]/.test(line) || /^journal:|^doi:|^published:|^source:|^has_/i.test(line)) continue
    const clean = line.replace(/^#+\s*/, "").replace(/<[^>]+>/g, "").trim()
    if (!clean || clean === "Untitled Article") continue
    if (/^[A-Za-z].{12,180}$/.test(clean) && !/(Technical Report|footnotetext|Equal contribution|^Amap Voice)/i.test(clean)) return clean
  }
  return ""
}

function inferAuthorsFromMarkdown(markdown) {
  const lines = String(markdown || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const title = inferTitleFromMarkdown(markdown)
  const idx = lines.findIndex((l) => l.includes(title))
  const line = idx >= 0 ? lines[idx + 1] : ""
  if (!line) return []
  return line.replace(/<sup>[\s\S]*?<\/sup>/g, "").split(/\s{2,}|,| and /).map((a) => a.replace(/[∗*†‡0-9]/g, "").trim()).filter(Boolean)
}

function bibtexKey(meta, arxivId) {
  const last = cleanAuthor(meta.authors?.[0] || "paper").split(/\s+/).at(-1)?.toLowerCase().replace(/[^a-z0-9]/g, "") || "paper"
  const year = String(meta.published || "").slice(0, 4) || new Date().getFullYear()
  const title = String(meta.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 28)
  return `${last}${year}${title || arxivId?.replace(/\D/g, "") || "paper"}`
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
    `pdf_url: ${yamlString(meta.urls.pdf || "")}`,
    `status: ${meta.status}`,
    "rating: 0",
    "tags:",
    ...tags.map((t) => `  - ${t}`),
    `created: ${meta.created}`,
    "---",
    "",
  ].join("\n")
}

function pendingMarkdown(meta, tags) {
  return frontmatter(meta, tags) + paperNav + [
    "## Links", "",
    `- [Original](${meta.urls.abs})`,
    meta.urls.pdf ? `- [PDF](${meta.urls.pdf})` : "",
    "",
    "## Status", "",
    `已用 paper-fetch 完成 fetch layer：source=${meta.fetch_source || "unknown"}。Summary 尚未生成或等待 retry。`,
    "",
    "## Abstract", "",
    meta.abstract || "", "",
    "## Citation", "",
    meta.publication_status || "目前以可取得 metadata 記錄；若之後找到正式 venue，再更新 citation。", "",
    "```bibtex",
    `@misc{${meta.bibtex_key},`,
    `  title={${meta.title}},`,
    `  author={${(meta.authors || []).join(" and ")}},`,
    `  year={${meta.year}},`,
    meta.arxiv_id ? `  eprint={${meta.arxiv_id}},` : "",
    meta.arxiv_id ? "  archivePrefix={arXiv}," : "",
    meta.primaryClass ? `  primaryClass={${meta.primaryClass}},` : "",
    meta.doi ? `  doi={${meta.doi}}` : "",
    "}",
    "```", "",
  ].filter((line) => line !== "").join("\n")
}

try {
  run("/home/openclaw/paper-fetch-skill/.venv/bin/paper-fetch", [
    "--query", url,
    "--format", "both",
    "--output-dir", fetchDir,
    "--artifact-mode", "none",
    "--max-tokens", "20000",
  ], { stdio: "inherit" })
} catch (err) {
  console.error("paper-fetch failed; falling back to deterministic arXiv ingest")
  run("node", ["scripts/process-paper-queue.mjs", "--url", url], { stdio: "inherit" })
  process.exit(0)
}

const out = findOutputJson()
if (!out) throw new Error(`paper-fetch produced no .both.json in ${fetchDir}`)
const data = JSON.parse(fs.readFileSync(out, "utf8"))
const article = data.article || {}
const md = data.markdown || ""
const m = article.metadata || {}
const arxivId = arxiv?.id || String(article.doi || "").match(/arxiv\.([0-9]{4}\.[0-9]{4,5})/i)?.[1] || ""
const inferredTitle = m.title || inferTitleFromMarkdown(md)
const inferredAuthors = (m.authors && m.authors.length ? m.authors : inferAuthorsFromMarkdown(md)).map(cleanAuthor)
const tags = shortTags({ title: inferredTitle || "", summary: m.abstract || md.slice(0, 2000) })
const absUrl = m.landing_page_url || (arxivId ? `https://arxiv.org/abs/${arxivId}` : url)
const pdfUrl = arxivId ? `https://arxiv.org/pdf/${arxivId}` : ""
const year = Number(String(m.published || "").slice(0, 4)) || new Date().getFullYear()
const meta = {
  paper_key: paperKey,
  canonical_id: arxivId ? `arxiv:${arxivId}` : (article.doi ? `doi:${article.doi}` : url),
  arxiv_id: arxivId,
  title: inferredTitle || paperKey,
  authors: inferredAuthors,
  venue: m.journal || "arXiv preprint",
  year,
  abstract: m.abstract || "",
  primaryClass: m.keywords?.[0] || "",
  categories: m.keywords || [],
  urls: { abs: absUrl, pdf: pdfUrl, source: arxivId ? `https://arxiv.org/src/${arxivId}` : "" },
  local_paths: {
    paper_fetch_json: path.relative(paperDir, out),
    paper_fetch_markdown: path.relative(paperDir, path.join(fetchDir, "paper-fetch.md")),
  },
  tags,
  concepts: [],
  status: existingMeta?.status === "read" || existingIndexRead ? "read" : "pending-summary",
  created: todayPacific(),
  doi: article.doi || (arxivId ? `10.48550/arXiv.${arxivId}` : ""),
  publication_status: m.journal === "arXiv" || arxivId ? `No formal conference or journal reference found as of ${todayPacific()}` : "Fetched from provider metadata; verify official venue if needed.",
  bibtex_key: bibtexKey({ ...m, title: inferredTitle, authors: inferredAuthors }, arxivId),
  fetch_source: article.source || "paper-fetch",
  quality: article.quality || {},
}
writeJson(path.join(paperDir, "metadata.json"), meta)
fs.writeFileSync(path.join(fetchDir, "paper-fetch.md"), md)
const indexPath = path.join(paperDir, "index.md")
if (!fs.existsSync(indexPath) || overwrite) fs.writeFileSync(indexPath, pendingMarkdown(meta, tags))
console.log(`paper-fetch ingested ${paperKey} from ${meta.fetch_source}`)
if (doSummarize) run("node", ["scripts/summarize-paper.mjs", paperKey], { stdio: "inherit" })
run("npm", ["run", "build:papers"], { stdio: "inherit" })
