import fs from "node:fs"
import path from "node:path"
import {
  ROOT, PAPERS, CACHE, QUEUE,
  ensureDirs, parseArxivId, paperKeyFromArxiv, getArxivMetadata,
  run, extractArchive, findEntrypoint, shortTags, writeJson, yamlString, todayPacific,
} from "./paper-common.mjs"

ensureDirs()
const args = process.argv.slice(2)
const urlArg = args.includes("--url") ? args[args.indexOf("--url") + 1] : args.find((a) => /^https?:|arxiv:/i.test(a))
const processAll = args.includes("--all") || !urlArg
const doSummarize = args.includes("--summarize")


async function download(url, out) {
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return
  run("curl", ["-L", "-f", "--retry", "3", "-o", out, url], { stdio: "inherit" })
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
    "## Links",
    "",
    `- [arXiv abstract](${meta.urls.abs})`,
    `- [PDF](${meta.urls.pdf})`,
    "",
    "## Status",
    "",
    "已完成 deterministic ingest：metadata、source archive、source extraction 都已存好。Summary 尚未生成或等待 retry。",
    "",
    "## Abstract",
    "",
    meta.abstract,
    "",
    "## Citation",
    "",
    "目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。",
    "",
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
    "```",
    "",
  ].filter((line) => line !== "").join("\n")
}

async function ingest(url) {
  const arxiv = parseArxivId(url)
  if (!arxiv) throw new Error(`Only arXiv URLs are implemented in deterministic ingest for now: ${url}`)
  const id = arxiv.id
  const paperKey = paperKeyFromArxiv(id)
  const paperDir = path.join(PAPERS, paperKey)
  const sourceDir = path.join(paperDir, "source")
  fs.mkdirSync(paperDir, { recursive: true })

  const existingMetaPath = path.join(paperDir, "metadata.json")
  let api
  try {
    api = await getArxivMetadata(id)
  } catch (err) {
    if (!fs.existsSync(existingMetaPath)) throw err
    const existing = JSON.parse(fs.readFileSync(existingMetaPath, "utf8"))
    api = {
      title: existing.title,
      summary: existing.abstract || existing.summary || "",
      authors: existing.authors || [],
      year: existing.year || new Date().getFullYear(),
      primaryClass: existing.primaryClass || "",
      categories: existing.categories || [],
    }
    console.warn(`arXiv metadata fetch failed; reused existing metadata for ${id}: ${err.message || err}`)
  }
  const sourceArchive = path.join(CACHE, "arxiv", `${id}${arxiv.version || ""}-src.tar.gz`)
  await download(`https://arxiv.org/src/${id}${arxiv.version || ""}`, sourceArchive)
  extractArchive(sourceArchive, sourceDir)
  const entrypoint = findEntrypoint(sourceDir)

  const tags = shortTags(api)
  const meta = {
    paper_key: paperKey,
    canonical_id: `arxiv:${id}`,
    arxiv_id: id,
    version: arxiv.version || "latest",
    title: api.title,
    authors: api.authors,
    venue: "arXiv preprint",
    year: api.year,
    abstract: api.summary,
    primaryClass: api.primaryClass,
    categories: api.categories,
    urls: {
      abs: `https://arxiv.org/abs/${id}`,
      pdf: `https://arxiv.org/pdf/${id}`,
      source: `https://arxiv.org/src/${id}`,
    },
    local_paths: {
      source_dir: "source",
      source_archive: path.relative(paperDir, sourceArchive),
      entrypoint: entrypoint ? path.relative(paperDir, entrypoint) : "",
    },
    tags,
    concepts: [],
    status: "pending-summary",
    created: todayPacific(),
    doi: `10.48550/arXiv.${id}`,
    publication_status: `No formal conference or journal reference found as of ${todayPacific()}`,
    bibtex_key: `${api.authors[0]?.split(/\s+/).at(-1)?.toLowerCase() || "paper"}${api.year}${api.title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30)}`,
  }

  writeJson(path.join(paperDir, "metadata.json"), meta)
  const indexPath = path.join(paperDir, "index.md")
  if (!fs.existsSync(indexPath) || args.includes("--overwrite")) fs.writeFileSync(indexPath, pendingMarkdown(meta, tags))
  console.log(`ingested ${paperKey}`)
  return paperKey
}

async function queueRows() {
  const q = path.join(QUEUE, "papers.jsonl")
  if (!fs.existsSync(q)) return []
  return fs.readFileSync(q, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line))
}

const donePath = path.join(QUEUE, "processed.json")
const done = fs.existsSync(donePath) ? JSON.parse(fs.readFileSync(donePath, "utf8")) : {}
const keys = []
if (urlArg) {
  keys.push(await ingest(urlArg))
} else if (processAll) {
  for (const row of await queueRows()) {
    if (done[row.paper_key]) continue
    try {
      const key = await ingest(row.url)
      done[row.paper_key] = { status: "ingested", key, at: new Date().toISOString() }
      keys.push(key)
    } catch (err) {
      done[row.paper_key] = { status: "error", error: String(err.message || err), at: new Date().toISOString() }
      console.error(`failed ${row.paper_key}: ${err.message || err}`)
    }
  }
  fs.writeFileSync(donePath, JSON.stringify(done, null, 2) + "\n")
}

if (doSummarize) {
  for (const key of keys) run("node", ["scripts/summarize-paper.mjs", key], { stdio: "inherit" })
}
run("npm", ["run", "build:papers"], { stdio: "inherit" })
