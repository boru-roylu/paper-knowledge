import fs from "node:fs"
import path from "node:path"
import {
  ROOT, PAPERS, CACHE, QUEUE,
  ensureDirs, parseArxivId, paperKeyFromArxiv, getArxivMetadata,
  run, extractArchive, findEntrypoint, shortTags, writeJson, yamlString, todayPacific,
  arxivYear, canonicalArxivUrls,
} from "./paper-common.mjs"

ensureDirs()
const args = process.argv.slice(2)
const urlArgs = args.filter((a) => /^https?:|arxiv:/i.test(a))
const urlArg = args.includes("--url") ? args[args.indexOf("--url") + 1] : urlArgs[0]
const processAll = args.includes("--all") || !urlArg
const doSummarize = args.includes("--summarize")
const noBuild = args.includes("--no-build")
const skipOpenReview = args.includes("--skip-openreview")
const llmPaceMs = Number(process.env.PAPER_LLM_STAGE_DELAY_MS || 3000)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function download(url, out) {
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return
  run("curl", ["-L", "-f", "--retry", "3", "-o", out, url], { stdio: "inherit" })
}

function texField(text, command) {
  const match = String(text || "").match(new RegExp(`\\\\${command}\\s*\\{([\\s\\S]*?)\\}`, "i"))
  return match ? match[1].replace(/\\\\[a-zA-Z]+\*?(?:\\[[^\\]]*\\])?\\{([^{}]*)\\}/g, "$1").replace(/[{}]/g, "").replace(/\s+/g, " ").trim() : ""
}

function inferApiFromTex(entrypoint, id, existingMeta) {
  const text = entrypoint && fs.existsSync(entrypoint) ? fs.readFileSync(entrypoint, "utf8") : ""
  return {
    title: texField(text, "title") || existingMeta?.title || id,
    summary: existingMeta?.abstract || existingMeta?.summary || "",
    authors: texField(text, "author")
      .split(/\s+and\s+|\\\\and|,/i)
      .map((a) => a.replace(/\\\\[a-zA-Z]+/g, "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 20) || existingMeta?.authors || [],
    year: arxivYear(id) || existingMeta?.year || new Date().getFullYear(),
    primaryClass: existingMeta?.primaryClass || "",
    categories: existingMeta?.categories || [],
  }
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
  const existingMeta = fs.existsSync(existingMetaPath) ? JSON.parse(fs.readFileSync(existingMetaPath, "utf8")) : null
  const existingIndexPath = path.join(paperDir, "index.md")
  const existingIndexRead = fs.existsSync(existingIndexPath) && /^status:\s*read\s*$/m.test(fs.readFileSync(existingIndexPath, "utf8"))
  let api = null
  const shouldFetchMetadata = args.includes("--refresh-metadata") || !existingMeta
  if (shouldFetchMetadata) {
    try {
      api = await getArxivMetadata(id)
    } catch (err) {
      if (!existingMeta) {
        api = {
          title: id,
          summary: "",
          authors: [],
          year: arxivYear(id) || new Date().getFullYear(),
          primaryClass: "",
          categories: [],
        }
      } else {
        console.warn(`arXiv metadata fetch failed; reused existing metadata for ${id}: ${err.message || err}`)
      }
    }
  }
  if (!api) {
    api = {
      title: existingMeta.title,
      summary: existingMeta.abstract || existingMeta.summary || "",
      authors: existingMeta.authors || [],
      year: arxivYear(id) || existingMeta.year || new Date().getFullYear(),
      primaryClass: existingMeta.primaryClass || "",
      categories: existingMeta.categories || [],
    }
  }
  const sourceArchive = path.join(CACHE, "arxiv", `${id}${arxiv.version || ""}-src.tar.gz`)
  await download(`https://arxiv.org/src/${id}${arxiv.version || ""}`, sourceArchive)
  extractArchive(sourceArchive, sourceDir)
  const entrypoint = findEntrypoint(sourceDir)
  if (!api.title || api.title === id) api = inferApiFromTex(entrypoint, id, existingMeta)

  const tags = Array.isArray(existingMeta?.tags) && existingMeta.tags.length ? existingMeta.tags : shortTags(api)
  const year = api.year || arxivYear(id) || new Date().getFullYear()
  const urls = canonicalArxivUrls(id)
  const meta = {
    paper_key: paperKey,
    canonical_id: `arxiv:${id}`,
    arxiv_id: id,
    version: arxiv.version || "latest",
    title: api.title,
    authors: api.authors,
    venue: "arXiv preprint",
    year,
    abstract: api.summary,
    primaryClass: api.primaryClass,
    categories: api.categories,
    urls,
    local_paths: {
      source_dir: "source",
      source_archive: path.relative(paperDir, sourceArchive),
      entrypoint: entrypoint ? path.relative(paperDir, entrypoint) : "",
    },
    tags,
    concepts: [],
    status: existingMeta?.status === "read" || existingIndexRead ? "read" : "pending-summary",
    created: existingMeta?.created || todayPacific(),
    doi: `10.48550/arXiv.${id}`,
    publication_status: `No formal conference or journal reference found as of ${todayPacific()}`,
    bibtex_key: `${api.authors[0]?.split(/\s+/).at(-1)?.toLowerCase() || "paper"}${year}${api.title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30)}`,
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
if (urlArgs.length) {
  for (const oneUrl of urlArgs) keys.push(await ingest(oneUrl))
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
  for (const key of keys) {
    run("node", ["scripts/summarize-paper.mjs", key], { stdio: "inherit" })
    if (!skipOpenReview) {
      await sleep(llmPaceMs)
      run("node", ["scripts/fetch-openreview-notes.mjs", key], { stdio: "inherit" })
      run("node", ["scripts/summarize-openreview-notes.mjs", key], { stdio: "inherit" })
      await sleep(llmPaceMs)
      run("node", ["scripts/summarize-paper.mjs", key], { stdio: "inherit" })
    }
    await sleep(llmPaceMs)
  }
}
if (!noBuild) run("npm", ["run", "build:papers"], { stdio: "inherit" })
