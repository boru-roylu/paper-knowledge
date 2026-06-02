import fs from "node:fs"
import path from "node:path"
import { ensureDirs, QUEUE, ROOT, run } from "./paper-common.mjs"

ensureDirs()

const args = process.argv.slice(2)
const lockPath = path.join(QUEUE, "worker.lock")
const queuePath = path.join(QUEUE, "papers.jsonl")
const processedPath = path.join(QUEUE, "processed.json")
const statusPath = path.join(QUEUE, "status.json")
const publish = !args.includes("--no-publish")
const skipOpenReview = args.includes("--skip-openreview")
const limitArg = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : 0

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n")
}

function queueRows() {
  if (!fs.existsSync(queuePath)) return []
  return fs.readFileSync(queuePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line, index) => ({ ...JSON.parse(line), queue_index: index + 1 }))
}

function processAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function queueSummary() {
  const rows = queueRows()
  const processed = readJson(processedPath, {})
  const pending = rows.filter((row) => processed[row.paper_key]?.status !== "done")
  return { total: rows.length, pending: pending.length }
}

function acquireLock() {
  try {
    const fd = fs.openSync(lockPath, "wx")
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }) + "\n")
    fs.closeSync(fd)
    return true
  } catch (err) {
    if (err.code !== "EEXIST") throw err
    const lock = readJson(lockPath, {})
    if (processAlive(lock.pid)) {
      const summary = queueSummary()
      console.log(`worker already running pid=${lock.pid}; pending=${summary.pending}; total=${summary.total}`)
      return false
    }
    fs.rmSync(lockPath, { force: true })
    return acquireLock()
  }
}

function updateStatus(paperKey, patch) {
  const status = readJson(statusPath, {})
  status[paperKey] = { ...(status[paperKey] || {}), ...patch, updated_at: new Date().toISOString() }
  writeJson(statusPath, status)
}

function markProcessed(paperKey, value) {
  const processed = readJson(processedPath, {})
  processed[paperKey] = { ...value, at: new Date().toISOString() }
  writeJson(processedPath, processed)
}

function pendingRows() {
  const processed = readJson(processedPath, {})
  const seen = new Set()
  const pending = []
  for (const row of queueRows()) {
    if (seen.has(row.paper_key)) continue
    seen.add(row.paper_key)
    if (processed[row.paper_key]?.status === "done") continue
    pending.push(row)
  }
  return limitArg > 0 ? pending.slice(0, limitArg) : pending
}

if (!acquireLock()) process.exit(0)

let processedAny = false
let failedAny = false

try {
  const rows = pendingRows()
  if (!rows.length) {
    const summary = queueSummary()
    console.log(`queue idle; pending=${summary.pending}; total=${summary.total}`)
  } else {
    console.log(`worker started; processing ${rows.length} paper(s) sequentially`)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const label = `${i + 1}/${rows.length} ${row.paper_key}`
      try {
        console.log(`started ${label}`)
        updateStatus(row.paper_key, { status: "processing", url: row.url, queue_index: row.queue_index, started_at: new Date().toISOString() })
        const ingestArgs = ["scripts/paper-fetch-ingest.mjs", "--summarize", "--url", row.url, "--no-build"]
        if (skipOpenReview) ingestArgs.push("--skip-openreview")
        run("node", ingestArgs, { stdio: "inherit" })
        updateStatus(row.paper_key, { status: "processed", url: row.url })
        markProcessed(row.paper_key, { status: "done", url: row.url })
        console.log(`finished ${label}`)
        processedAny = true
      } catch (err) {
        failedAny = true
        const message = String(err.message || err)
        updateStatus(row.paper_key, { status: "failed", url: row.url, error: message })
        markProcessed(row.paper_key, { status: "failed", url: row.url, error: message })
        console.error(`failed ${label}: ${message}`)
      }
    }

    if (processedAny) {
      console.log("building paper site")
      updateStatus("_worker", { status: "building" })
      run("npm", ["run", "build:papers"], { stdio: "inherit" })
      if (publish) {
        console.log("publishing paper site")
        updateStatus("_worker", { status: "publishing" })
        run("npm", ["run", "paper:publish", "--", "--no-build"], { stdio: "inherit" })
      }
    }

    const summary = queueSummary()
    updateStatus("_worker", { status: failedAny ? "finished-with-errors" : "done", pending: summary.pending, total: summary.total })
    console.log(`worker done; pending=${summary.pending}; total=${summary.total}`)
  }
} finally {
  fs.rmSync(lockPath, { force: true })
}
