import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"

const papersDir = path.resolve("content/papers")
const staticDir = path.resolve("content/static")

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

function sourceArchivePath(paper) {
  const raw = paper.meta.local_paths?.source_archive
  if (raw) {
    const fromMeta = path.resolve(paper.dir, raw)
    if (fs.existsSync(fromMeta)) return fromMeta
    const fromRepo = path.resolve(raw)
    if (fs.existsSync(fromRepo)) return fromRepo
  }
  if (paper.arxiv_id) {
    const candidates = [
      path.resolve("cache", "arxiv", `${paper.arxiv_id}-src.tar.gz`),
      path.resolve("cache", "arxiv", `${paper.arxiv_id}v1-src.tar.gz`),
    ]
    for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate
  }
  return ""
}

function extractSourceArchive(archive) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paper-citations-"))
  execFileSync("tar", ["-xzf", archive, "-C", dir], { stdio: "ignore" })
  return dir
}

function readSourceRoots(paper) {
  const roots = []
  const sourceDir = path.join(paper.dir, "source")
  if (fs.existsSync(sourceDir)) roots.push({ dir: sourceDir, label: "source", cleanup: false })
  const archive = sourceArchivePath(paper)
  if (archive) {
    const extracted = extractSourceArchive(archive)
    roots.push({ dir: extracted, label: `arxiv-src:${path.basename(archive)}`, cleanup: true })
  }
  return roots
}

function parseCitationKeys(tex) {
  const keys = new Set()
  const citeCommand = /\\(?:no)?cite[a-zA-Z*]*(?:\s*\[[^\]]*\]){0,2}\s*\{([^{}]+)\}/g
  for (const m of tex.matchAll(citeCommand)) {
    for (const key of m[1].split(",")) {
      const clean = key.trim()
      if (clean && clean !== "*") keys.add(clean)
    }
  }
  return keys
}

function parseBibFields(body) {
  const fields = {}
  let i = body.indexOf(",")
  if (i < 0) return fields
  i += 1
  while (i < body.length) {
    while (i < body.length && /[\s,]/.test(body[i])) i++
    const nameMatch = body.slice(i).match(/^([a-zA-Z][\w-]*)\s*=/)
    if (!nameMatch) {
      i++
      continue
    }
    const name = nameMatch[1].toLowerCase()
    i += nameMatch[0].length
    while (i < body.length && /\s/.test(body[i])) i++
    let value = ""
    if (body[i] === "{") {
      let depth = 0
      const start = i + 1
      for (; i < body.length; i++) {
        if (body[i] === "{") depth++
        else if (body[i] === "}") {
          depth--
          if (depth === 0) {
            value = body.slice(start, i)
            i++
            break
          }
        }
      }
    } else if (body[i] === '"') {
      const start = ++i
      for (; i < body.length; i++) {
        if (body[i] === '"' && body[i - 1] !== "\\") {
          value = body.slice(start, i)
          i++
          break
        }
      }
    } else {
      const start = i
      while (i < body.length && body[i] !== ",") i++
      value = body.slice(start, i).trim()
    }
    fields[name] = value.trim()
  }
  return fields
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
    const body = text.slice(open + 1, j)
    const key = body.match(/^\s*([^,\s]+)\s*,/)?.[1] || ""
    const fields = parseBibFields(body)
    const refText = Object.values(fields).join(" ")
    if (fields.title) {
      entries.push({
        key,
        title: stripLatex(fields.title),
        authors: fields.author || "",
        first_author_last: firstAuthorLastName(fields.author || ""),
        year: fields.year || "",
        arxiv_id: fields.eprint || refText.match(/arxiv[:.\/ ]+([0-9]{4}\.[0-9]{4,5})/i)?.[1] || fields.url?.match(/arxiv\.org\/abs\/([0-9]{4}\.[0-9]{4,5})/i)?.[1] || "",
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
    const quotedTitle = chunk.match(/``([\s\S]*?),''/)?.[1] || chunk.match(/"([^"]+)"/)?.[1] || ""
    const title = blocks[1] || stripLatex(quotedTitle).replace(/\s+/g, " ").trim()
    const authors = blocks[0] || stripLatex(chunk.split(/``|"/)[0] || "").replace(/\s+/g, " ").trim()
    return {
      title,
      authors,
      first_author_last: firstAuthorLastName(authors),
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

function buildPaperKeyResolver(papers) {
  const byId = new Map()
  for (const paper of papers) {
    byId.set(paper.key, paper.key)
    if (paper.arxiv_id) {
      byId.set(`arxiv:${paper.arxiv_id}`, paper.key)
      byId.set(paper.arxiv_id, paper.key)
      byId.set(`arxiv_${paper.arxiv_id.replace(".", "_")}`, paper.key)
    }
    if (paper.meta.canonical_id) byId.set(String(paper.meta.canonical_id), paper.key)
  }
  return (id) => byId.get(String(id || "").trim()) || ""
}

function readReferences(paper) {
  const roots = readSourceRoots(paper)
  const refs = []
  try {
    for (const root of roots) {
      const files = listFiles(root.dir)
      const bblFiles = files.filter((f) => /\.bbl$/i.test(f))
      const bibFiles = files.filter((f) => /\.bib$/i.test(f))
      const texFiles = files.filter((f) => /\.(tex|ltx)$/i.test(f))
      const citedKeys = new Set()
      for (const f of texFiles) {
        const text = fs.readFileSync(f, "utf8")
        for (const key of parseCitationKeys(text)) citedKeys.add(key)
      }
      const rel = (f) => `${root.label}/${path.relative(root.dir, f)}`
      if (bblFiles.length) {
        for (const f of bblFiles) {
          const text = fs.readFileSync(f, "utf8")
          refs.push(...parseBblEntries(text).map((r) => ({ ...r, source_file: rel(f) })))
        }
      } else {
        for (const f of bibFiles) {
          const text = fs.readFileSync(f, "utf8")
          refs.push(...parseBibEntries(text)
            .filter((r) => citedKeys.size === 0 || citedKeys.has(r.key))
            .map((r) => ({ ...r, source_file: rel(f) })))
        }
      }
    }
  } finally {
    for (const root of roots) {
      if (root.cleanup) fs.rmSync(root.dir, { recursive: true, force: true })
    }
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

const papers = readPapers()
const resolvePaperKey = buildPaperKeyResolver(papers)
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
      .map((c) => {
        const rawKey = typeof c === "string" ? c : c?.paper_key
        const paperKey = resolvePaperKey(rawKey)
        const target = papers.find((p) => p.key === paperKey)
        if (!target) return null
        return {
          ...(typeof c === "string" ? {} : c),
          paper_key: paperKey,
          title: target.title,
          score: typeof c === "string" ? 1 : c.score || 1,
          source_file: typeof c === "string" ? "metadata.citations" : c.source_file || "metadata.citations",
        }
      })
      .filter(Boolean)
  } else {
    const matches = refs.map((ref) => matchReference(ref, papers, paper.key)).filter(Boolean)
    const byKey = new Map()
    for (const m of matches) if (!byKey.has(m.paper_key) || m.score > byKey.get(m.paper_key).score) byKey.set(m.paper_key, m)
    citations = [...byKey.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  }
  paper.meta.citations = citations
  fs.writeFileSync(paper.metaPath, JSON.stringify(paper.meta, null, 2) + "\n")
  graph[paper.key] = citations.map((c) => c.paper_key)
  for (const c of citations) graphData.edges.push({ source: paper.key, target: c.paper_key, score: c.score || 1 })
}
fs.writeFileSync(path.resolve("content/citation-graph.json"), JSON.stringify(graph, null, 2) + "\n")
fs.mkdirSync(staticDir, { recursive: true })
fs.writeFileSync(path.join(staticDir, "citation-graph-data.json"), JSON.stringify(graphData, null, 2) + "\n")
console.log(`updated citation graph for ${papers.length} papers`)
