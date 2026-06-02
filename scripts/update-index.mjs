import fs from "node:fs"
import path from "node:path"

const papersDir = path.resolve("content/papers")
const toolsDir = path.resolve("content/tools")
const papers = []
const tools = []
const coreTags = new Set([
  "speech-llm",
  "audio-reasoning",
  "full-duplex",
  "speech-data",
  "tts",
  "asr",
  "diarization",
  "preprocessing",
  "project-full-duplex-data",
  "project-tts-data-pipeline",
])

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function tagLabel(tag) {
  return tag.replace(/^project-/, "project: ").replaceAll("-", " ")
}

function pageHref(key) {
  return `./papers/${key}/`
}

function toolHref(key) {
  return `./tools/${key}/`
}

function tagHref(tag) {
  return `./tags/${tag}/`
}

function readFrontmatterCreated(key) {
  const indexPath = path.join(papersDir, key, "index.md")
  if (!fs.existsSync(indexPath)) return ""
  return fs.readFileSync(indexPath, "utf8").match(/^created:\s*([0-9-]+)/m)?.[1] || ""
}

if (fs.existsSync(papersDir)) {
  for (const entry of fs.readdirSync(papersDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const metaPath = path.join(papersDir, entry.name, "metadata.json")
    if (!fs.existsSync(metaPath)) continue
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"))
    const tags = Array.isArray(meta.tags) ? meta.tags : []
    papers.push({
      key: meta.paper_key || entry.name,
      title: meta.title || entry.name,
      created: meta.created || readFrontmatterCreated(entry.name) || "unknown",
      sortDate: meta.created || readFrontmatterCreated(entry.name) || "0000-00-00",
      year: meta.year || "",
      venue: meta.venue || meta.publication_status || "",
      tags,
      canonical_id: meta.canonical_id || meta.arxiv_id || "",
    })
  }
}

if (fs.existsSync(toolsDir)) {
  for (const entry of fs.readdirSync(toolsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const metaPath = path.join(toolsDir, entry.name, "metadata.json")
    if (!fs.existsSync(metaPath)) continue
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"))
    const tags = Array.isArray(meta.tags) ? meta.tags : []
    tools.push({
      key: meta.tool_key || entry.name,
      title: meta.title || entry.name,
      created: meta.created || "unknown",
      sortDate: meta.created || "0000-00-00",
      kind: meta.kind || "tool",
      repo: meta.repo || "",
      url: meta.url || "",
      description: meta.description || "",
      tags,
    })
  }
}

papers.sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)) || String(b.year).localeCompare(String(a.year)) || a.title.localeCompare(b.title))
tools.sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)) || a.title.localeCompare(b.title))

const allTags = [...new Set([...papers.flatMap((p) => p.tags), ...tools.flatMap((t) => t.tags)])].sort((a, b) => {
  const ai = coreTags.has(a) ? 0 : 1
  const bi = coreTags.has(b) ? 0 : 1
  return ai - bi || a.localeCompare(b)
})

const lines = [
  "---",
  "title: Paper Knowledge",
  "---",
  "",
  "## Papers by Added Date",
  "",
  "<div class=\"paper-filter\">",
  "  <input id=\"paper-filter-input\" type=\"search\" placeholder=\"Filter by title, tag, venue, or arXiv ID\" />",
  "  <div class=\"paper-filter-tags\">",
  "    <button type=\"button\" data-paper-tag=\"\">All</button>",
]

for (const tag of allTags) {
  lines.push(`    <button type="button" data-paper-tag="${esc(tag)}">${esc(tagLabel(tag))}</button>`)
}

lines.push("  </div>", "</div>", "", "<div class=\"paper-list\">")

for (const paper of papers) {
  const suffix = [paper.year, paper.venue].filter(Boolean).join(", ")
  const haystack = esc([paper.title, paper.key, paper.created, paper.year, paper.venue, paper.canonical_id, ...paper.tags].join(" "))
  lines.push(`<div class="paper-row" data-tags="${esc(paper.tags.join(" "))}" data-search="${haystack}">`)
  lines.push(`  <div class="paper-date">${esc(paper.created)}</div>`)
  lines.push(`  <div class="paper-main"><a class="internal" href="${pageHref(paper.key)}">${esc(paper.title)}</a>${suffix ? ` <span class="paper-meta">(${esc(suffix)})</span>` : ""}</div>`)
  if (paper.tags.length) {
    lines.push(`  <div class="paper-tags">${paper.tags.map((tag) => `<a class="tag-link internal" href="${tagHref(tag)}">#${esc(tag)}</a>`).join(" ")}</div>`)
  }
  lines.push("</div>")
}

lines.push(
  "</div>",
  "",
  "<script src=\"./static/paper-filter.js?v=2\" defer></script>",
  "",
)

if (tools.length) {
  lines.push("## Tools / Repos / Notes", "", "<div class=\"paper-list tool-list\">")

  for (const tool of tools) {
    const suffix = [tool.kind, tool.repo].filter(Boolean).join(", ")
    const haystack = esc([tool.title, tool.key, tool.created, tool.kind, tool.repo, tool.description, ...tool.tags].join(" "))
    lines.push(`<div class="paper-row" data-tags="${esc(tool.tags.join(" "))}" data-search="${haystack}">`)
    lines.push(`  <div class="paper-date">${esc(tool.created)}</div>`)
    lines.push(`  <div class="paper-main"><a class="internal" href="${toolHref(tool.key)}">${esc(tool.title)}</a>${suffix ? ` <span class="paper-meta">(${esc(suffix)})</span>` : ""}</div>`)
    if (tool.description) {
      lines.push(`  <div class="paper-summary">${esc(tool.description)}</div>`)
    }
    if (tool.tags.length) {
      lines.push(`  <div class="paper-tags">${tool.tags.map((tag) => `<a class="tag-link internal" href="${tagHref(tag)}">#${esc(tag)}</a>`).join(" ")}</div>`)
    }
    lines.push("</div>")
  }

  lines.push("</div>", "")
}

lines.push(
  "## Projects",
  "",
  "- [Project: Full-duplex data and model](./tags/project-full-duplex-data/)",
  "- [Project: TTS data pipeline](./tags/project-tts-data-pipeline/)",
  "- [Citation graph](./citation-graph/)",
  "",
  "## Core Tags",
  "",
  "#speech-llm #audio-reasoning #full-duplex #speech-data #tts #asr #diarization #preprocessing",
  "",
)
fs.writeFileSync(path.resolve("content/index.md"), lines.join("\n"))
