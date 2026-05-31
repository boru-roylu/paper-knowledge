import fs from "node:fs"
import path from "node:path"
import { ensureDirs, QUEUE, parseArxivId, paperKeyFromArxiv, todayPacific } from "./paper-common.mjs"

ensureDirs()
const url = process.argv.slice(2).find((a) => !a.startsWith("--"))
if (!url) throw new Error("Usage: node scripts/enqueue-paper.mjs <paper-url>")
const arxiv = parseArxivId(url)
const paperKey = arxiv ? paperKeyFromArxiv(arxiv.id) : `web_${Date.now()}`
const row = { url, paper_key: paperKey, status: "queued", created: todayPacific() }
fs.appendFileSync(path.join(QUEUE, "papers.jsonl"), JSON.stringify(row) + "\n")
console.log(`queued ${paperKey}`)
