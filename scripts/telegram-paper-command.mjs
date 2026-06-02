import fs from "node:fs"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { QUEUE, ensureDirs, parseArxivId, paperKeyFromArxiv } from "./paper-common.mjs"

ensureDirs()

const ROOT = process.cwd()
const args = process.argv.slice(2)
const commandAliases = {
  paper_add: "add",
  paper_status: "status",
  pstatus: "status",
  paper_queue: "queue",
  pqueue: "queue",
}
const rawCommand = (args[0] || "").replace(/^\//, "").toLowerCase()
const command = commandAliases[rawCommand] || rawCommand
const urlRe = /https?:\/\/\S+|arxiv:\d{4}\.\d{4,5}(?:v\d+)?/gi

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function queueRows() {
  const file = path.join(QUEUE, "papers.jsonl")
  if (!fs.existsSync(file)) return []
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line, index) => ({ ...JSON.parse(line), queue_index: index + 1 }))
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

function pendingRows() {
  const processed = readJson(path.join(QUEUE, "processed.json"), {})
  return queueRows().filter((row) => !["done", "failed", "ignored"].includes(processed[row.paper_key]?.status))
}

function failedRows() {
  const processed = readJson(path.join(QUEUE, "processed.json"), {})
  return queueRows().filter((row) => processed[row.paper_key]?.status === "failed")
}

function isLikelyPaperUrl(url) {
  return /arxiv\.org\/(?:abs|pdf|src)\//i.test(url)
    || /^arxiv:\d{4}\.\d{4,5}/i.test(url)
    || /openreview\.net\/forum/i.test(url)
    || /aclanthology\.org\//i.test(url)
    || /doi\.org\/10\./i.test(url)
    || /^10\.\d{4,9}\//i.test(url)
    || /\.pdf(?:$|[?#])/i.test(url)
}

function workerState() {
  const lock = readJson(path.join(QUEUE, "worker.lock"), null)
  const status = readJson(path.join(QUEUE, "status.json"), {})
  return {
    running: Boolean(lock?.pid && processAlive(lock.pid)),
    lock,
    status,
    worker: status._worker || {},
  }
}

function keyForUrl(url) {
  const arxiv = parseArxivId(url)
  return arxiv ? paperKeyFromArxiv(arxiv.id) : ""
}

function startWorker() {
  fs.mkdirSync(QUEUE, { recursive: true })
  const logFd = fs.openSync(path.join(QUEUE, "worker.log"), "a")
  const child = spawn("npm", ["run", "paper:worker"], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  })
  child.unref()
  fs.closeSync(logFd)
  return child.pid
}

function add(urls) {
  if (!urls.length) {
    console.log("Usage: /add <paper-url...>")
    return
  }
  const unsupported = urls.filter((url) => !isLikelyPaperUrl(url))
  urls = urls.filter(isLikelyPaperUrl)
  if (!urls.length) {
    console.log([
      "No supported paper URLs found.",
      "Supported: arXiv, OpenReview forum, ACL Anthology, DOI, direct PDF.",
      unsupported.length ? `Ignored: ${unsupported.join(", ")}` : "",
    ].filter(Boolean).join("\n"))
    return
  }
  const before = new Set(queueRows().map((row) => row.paper_key))
  const enqueue = spawnSync("npm", ["run", "paper:queue", "--", ...urls], { cwd: ROOT, encoding: "utf8" })
  if (enqueue.status !== 0) {
    console.log(`queue failed:\n${(enqueue.stderr || enqueue.stdout || "").slice(0, 1200)}`)
    process.exitCode = 1
    return
  }
  const afterRows = queueRows()
  const pending = pendingRows()
  const queuedKeys = urls.map((url) => keyForUrl(url)).filter(Boolean)
  const lines = []
  lines.push(`Queued ${urls.length} URL(s).`)
  for (const key of queuedKeys) lines.push(`${before.has(key) ? "Already queued" : "Queued"}: ${key}`)
  for (const url of unsupported) lines.push(`Ignored unsupported URL: ${url}`)
  const pid = startWorker()
  const state = workerState()
  lines.push(state.running ? `Worker already running pid=${state.lock?.pid}.` : `Worker launched pid=${pid}.`)
  lines.push(`Pending: ${pending.length} / Total queued: ${afterRows.length}`)
  lines.push("Use /paper_status to check progress.")
  console.log(lines.join("\n"))
}

function status() {
  const pending = pendingRows()
  const failed = failedRows()
  const rows = queueRows()
  const state = workerState()
  const statusEntries = Object.entries(state.status)
    .filter(([key]) => key !== "_worker")
    .slice(-5)
  const lines = []
  lines.push(state.running ? `Worker: running pid=${state.lock?.pid}` : "Worker: idle")
  if (state.worker.status) lines.push(`Last worker status: ${state.worker.status}`)
  lines.push(`Pending: ${pending.length} / Total queued: ${rows.length}`)
  if (failed.length) lines.push(`Failed: ${failed.length}`)
  if (pending.length) lines.push(`Next: ${pending.slice(0, 5).map((row) => row.paper_key).join(", ")}`)
  if (statusEntries.length) {
    lines.push("Recent:")
    for (const [key, value] of statusEntries) lines.push(`- ${key}: ${value.status || "unknown"}`)
  }
  console.log(lines.join("\n"))
}

function queue() {
  const pending = pendingRows()
  if (!pending.length) {
    console.log("Queue is empty.")
    return
  }
  console.log(["Pending queue:", ...pending.slice(0, 20).map((row) => `${row.queue_index}. ${row.paper_key} ${row.url}`)].join("\n"))
}

if (command === "add") {
  const text = args.slice(1).join(" ")
  add([...text.matchAll(urlRe)].map((m) => m[0].replace(/[)>.,]+$/g, "")))
} else if (command === "status") {
  status()
} else if (command === "queue") {
  queue()
} else {
  console.log("Supported commands: /add <url...>, /paper_status, /paper_queue")
  process.exitCode = 2
}
