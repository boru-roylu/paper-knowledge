import fs from "node:fs"
import path from "node:path"

const papersDir = path.resolve("content/papers")
const staticDir = path.resolve("content/static")
const start = "<!-- citation-graph:start -->"
const end = "<!-- citation-graph:end -->"

function listFiles(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...listFiles(p))
    else out.push(p)
  }
  return out
}

function stripLatex(s) {
  return String(s || "")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{([^{}]*)\})?/g, "$1")
    .replace(/\\['"`^~=cHkruv]\{?([A-Za-z])\}?/g, "$1")
    .replace(/[{}$]/g, "")
    .replace(/~|\\&/g, " ")
    .replace(/&amp;/g, "&")
}

function normalizeTitle(s) {
  return stripLatex(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|and|or|of|for|to|in|on|with|via|by|from|towards?|toward)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function titleTokens(s) {
  return normalizeTitle(s).split(" ").filter((t) => t.length > 1)
}

function firstAuthorLastName(authors) {
  const first = Array.isArray(authors) ? authors[0] : String(authors || "").split(/\s+and\s+|,/i)[0]
  if (!first) return ""
  const clean = stripLatex(first).replace(/\bet\s+al\.?/i, "").trim()
  if (clean.includes(",")) return normalizeTitle(clean.split(",")[0]).split(" ").at(-1) || ""
  return normalizeTitle(clean).split(" ").at(-1) || ""
}

function parseBibEntries(text) {
  const entries = []
  let i = 0
  while (i < text.length) {
    const at = text.indexOf("@", i)
    if (at < 0) break
    const open = text.indexOf("{", at)
    if (open < 0) break
    let depth = 0
    let j = open
    for (; j < text.length; j++) {
      if (text[j] === "{") depth++
      else if (text[j] === "}") {
        depth--
        if (depth === 0) break
      }
    }
    const raw = text.slice(at, j + 1)
    const body = raw.slice(open + 1, -1)
    const fields = {}
    for (const m of body.matchAll(/([a-zA-Z][\w-]*)\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|[^,\n]+)\s*,?/g)) {
      fields[m[1].toLowerCase()] = m[2].replace(/^["{]|["}]$/g, "").trim()
    }
    if (fields.title) {
      entries.push({
        title: stripLatex(fields.title),
        authors: fields.author || "",
        first_author_last: firstAuthorLastName(fields.author || ""),
        year: fields.year || "",
        arxiv_id: fields.eprint || fields.url?.match(/arxiv\.org\/abs\/([0-9]{4}\.[0-9]{4,5})/i)?.[1] || "",
      })
    }
    i = Math.max(j + 1, open + 1)
  }
  return entries
}

function parseBblEntries(text) {
  const chunks = text.split(/\\bibitem(?:\[[^\]]*\])?\{[^}]+\}/g).slice(1)
  return chunks.map((chunk) => {
    const blocks = chunk.split(/\\newblock/g).map((s) => stripLatex(s).replace(/\s+/g, " ").trim()).filter(Boolean)
    return {
      title: blocks[1] || "",
      authors: blocks[0] || "",
      first_author_last: firstAuthorLastName(blocks[0] || ""),
      year: chunk.match(/\b(19|20)[0-9]{2}\b/)?.[0] || "",
      arxiv_id: chunk.match(/arxiv[:.\/ ]+([0-9]{4}\.[0-9]{4,5})/i)?.[1] || "",
    }
  }).filter((r) => r.title)
}

function scoreTitle(refTitle, paperTitle) {
  const a = titleTokens(refTitle)
  const b = titleTokens(paperTitle)
  if (!a.length || !b.length) return 0
  const as = new Set(a)
  const bs = new Set(b)
  let inter = 0
  for (const t of as) if (bs.has(t)) inter++
  const dice = (2 * inter) / (as.size + bs.size)
  const na = normalizeTitle(refTitle)
  const nb = normalizeTitle(paperTitle)
  if (na.length > 20 && nb.length > 20 && (na.includes(nb) || nb.includes(na))) return Math.max(dice, 0.97)
  return dice
}

function readPapers() {
  if (!fs.existsSync(papersDir)) return []
  return fs.readdirSync(papersDir, { withFileTypes: true })
    .filter((ent) => ent.isDirectory())
    .map((ent) => {
      const dir = path.join(papersDir, ent.name)
      const metaPath = path.join(dir, "metadata.json")
      if (!fs.existsSync(metaPath)) return null
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"))
      return {
        key: ent.name,
        dir,
        metaPath,
        indexPath: path.join(dir, "index.md"),
        meta,
        title: meta.title || ent.name,
        first_author_last: firstAuthorLastName(meta.authors || []),
        arxiv_id: meta.arxiv_id || String(meta.canonical_id || "").match(/arxiv:([0-9]{4}\.[0-9]{4,5})/i)?.[1] || "",
      }
    })
    .filter(Boolean)
}

function readReferences(paper) {
  const sourceDir = path.join(paper.dir, "source")
  const files = listFiles(sourceDir).filter((f) => /\.(bib|bbl)$/i.test(f))
  const refs = []
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8")
    refs.push(...(f.endsWith(".bib") ? parseBibEntries(text) : parseBblEntries(text)).map((r) => ({ ...r, source_file: path.relative(paper.dir, f) })))
  }
  const seen = new Set()
  return refs.filter((r) => {
    const k = normalizeTitle(r.title)
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function matchReference(ref, papers, sourceKey) {
  let best = null
  for (const paper of papers) {
    if (paper.key === sourceKey) continue
    let score = 0
    if (ref.arxiv_id && paper.arxiv_id && ref.arxiv_id === paper.arxiv_id) score = 1
    else {
      score = scoreTitle(ref.title, paper.title)
      const refLast = ref.first_author_last
      const paperLast = paper.first_author_last
      const authorOk = !refLast || !paperLast || refLast === paperLast
      if (!authorOk && score < 0.97) score -= 0.2
    }
    if (!best || score > best.score) best = { paper, score }
  }
  if (!best) return null
  const refLast = ref.first_author_last
  const paperLast = best.paper.first_author_last
  const authorOk = !refLast || !paperLast || refLast === paperLast
  if (best.score >= 0.9 || (best.score >= 0.78 && authorOk)) {
    return {
      paper_key: best.paper.key,
      title: best.paper.title,
      score: Number(best.score.toFixed(3)),
      matched_title: ref.title,
      matched_first_author_last: refLast || "",
      source_file: ref.source_file,
    }
  }
  return null
}

function citationBlock(paper, citedPapers) {
  const lines = [
    "## Citation Graph",
    "",
    start,
    "",
  ]
  if (citedPapers.length) {
    lines.push("Cites local papers:")
    lines.push("")
    for (const edge of citedPapers) {
      lines.push(`- [${edge.title}](../${edge.paper_key}/)`)
    }
  } else {
    lines.push("No local paper citations matched yet.")
  }
  lines.push("", end, "")
  return lines.join("\n")
}

function updateIndex(paper, citedPapers) {
  if (!fs.existsSync(paper.indexPath)) return
  let text = fs.readFileSync(paper.indexPath, "utf8")
  const block = citationBlock(paper, citedPapers)
  const re = new RegExp(`\\n?## Citation Graph\\n\\n${start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`, "m")
  if (re.test(text)) text = text.replace(re, `\n${block}`)
  else if (/^## Citation\s*$/m.test(text)) text = text.replace(/^## Citation\s*$/m, `${block}\n## Citation`)
  else text = `${text.trim()}\n\n${block}`
  fs.writeFileSync(paper.indexPath, text.trim() + "\n")
}

const papers = readPapers()
const graph = {}
const graphData = {
  nodes: papers.map((paper) => ({
    id: paper.key,
    title: paper.title,
    year: paper.meta.year || "",
    venue: paper.meta.venue || "",
    url: `../papers/${paper.key}/`,
    tags: Array.isArray(paper.meta.tags) ? paper.meta.tags : [],
  })),
  edges: [],
}
for (const paper of papers) {
  const refs = readReferences(paper)
  let citations
  if (refs.length === 0 && Array.isArray(paper.meta.citations)) {
    citations = paper.meta.citations
  } else {
    const matches = refs.map((ref) => matchReference(ref, papers, paper.key)).filter(Boolean)
    const byKey = new Map()
    for (const m of matches) if (!byKey.has(m.paper_key) || m.score > byKey.get(m.paper_key).score) byKey.set(m.paper_key, m)
    citations = [...byKey.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  }
  paper.meta.citations = citations
  fs.writeFileSync(paper.metaPath, JSON.stringify(paper.meta, null, 2) + "\n")
  updateIndex(paper, citations)
  graph[paper.key] = citations.map((c) => c.paper_key)
  for (const c of citations) graphData.edges.push({ source: paper.key, target: c.paper_key, score: c.score || 1 })
}
fs.writeFileSync(path.resolve("content/citation-graph.json"), JSON.stringify(graph, null, 2) + "\n")
fs.mkdirSync(staticDir, { recursive: true })
fs.writeFileSync(path.join(staticDir, "citation-graph-data.json"), JSON.stringify(graphData, null, 2) + "\n")
console.log(`updated citation graph for ${papers.length} papers`)
