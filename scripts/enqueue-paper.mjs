import fs from "node:fs"
import path from "node:path"
import { ensureDirs, QUEUE, parseArxivId, paperKeyFromArxiv, todayPacific } from "./paper-common.mjs"

ensureDirs()
const urls = process.argv.slice(2).filter((a) => !a.startsWith("--"))
if (!urls.length) throw new Error("Usage: node scripts/enqueue-paper.mjs <paper-url...>")
const queuePath = path.join(QUEUE, "papers.jsonl")
const existing = fs.existsSync(queuePath)
  ? new Set(fs.readFileSync(queuePath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line).paper_key))
  : new Set()
for (const url of urls) {
  const arxiv = parseArxivId(url)
  const paperKey = arxiv ? paperKeyFromArxiv(arxiv.id) : `web_${Date.now()}`
  if (existing.has(paperKey)) {
    console.log(`already queued ${paperKey}`)
    continue
  }
  const row = { url, paper_key: paperKey, status: "queued", created: todayPacific() }
  fs.appendFileSync(queuePath, JSON.stringify(row) + "\n")
  existing.add(paperKey)
  console.log(`queued ${paperKey}`)
}
