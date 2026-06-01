import fs from "node:fs"
import path from "node:path"
import { PAPERS, writeJson } from "./paper-common.mjs"

const key = process.argv[2]
const all = process.argv.includes("--all")
if (!key && !all) throw new Error("Usage: node scripts/fetch-openreview-notes.mjs <paper_key>|--all")

function value(field) {
  return field && typeof field === "object" && "value" in field ? field.value : field
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function similarity(a, b) {
  const A = new Set(norm(a).split(/\s+/).filter(Boolean))
  const B = new Set(norm(b).split(/\s+/).filter(Boolean))
  if (!A.size || !B.size) return 0
  let hit = 0
  for (const t of A) if (B.has(t)) hit++
  return hit / Math.max(A.size, B.size)
}

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "paper-knowledge/0.1 roylu" } })
  if (!res.ok) throw new Error(`OpenReview ${res.status}: ${url}`)
  return res.json()
}

function noteText(note) {
  const c = note.content || {}
  const keys = [
    "title", "venue", "decision", "recommendation", "rating", "confidence",
    "summary", "review", "main_review", "strengths", "weaknesses",
    "questions", "limitations", "comment", "official_comment", "rebuttal",
    "TL;DR",
  ]
  const lines = []
  for (const k of keys) {
    const v = value(c[k])
    if (Array.isArray(v)) lines.push(`- ${k}: ${v.join(", ")}`)
    else if (v) lines.push(`- ${k}: ${String(v).replace(/\s+/g, " ").trim()}`)
  }
  return lines.join("\n")
}

async function fetchForPaper(paperKey) {
  const paperDir = path.join(PAPERS, paperKey)
  const metaPath = path.join(paperDir, "metadata.json")
  if (!fs.existsSync(metaPath)) return
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"))
  const title = meta.title || paperKey
  const searchUrl = `https://api2.openreview.net/notes/search?term=${encodeURIComponent(title)}&content=title&limit=10`
  const search = await getJson(searchUrl)
  const candidates = (search.notes || [])
    .map((note) => ({ note, score: similarity(title, value(note.content?.title)) }))
    .filter((row) => row.score >= 0.72)
    .sort((a, b) => b.score - a.score)
  if (!candidates.length) return

  const submission = candidates[0].note
  const forum = submission.forum || submission.id
  const forumUrl = `https://api2.openreview.net/notes?forum=${encodeURIComponent(forum)}&limit=1000`
  const forumData = await getJson(forumUrl)
  const notes = forumData.notes || []
  const interesting = notes.filter((note) => {
    const text = `${note.invitation || ""} ${Object.keys(note.content || {}).join(" ")} ${noteText(note)}`
    return /review|rebuttal|response|comment|decision|recommendation|weakness|strength|rating|confidence/i.test(text)
  })

  const outDir = path.join(paperDir, "reviews")
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, "openreview.md")
  const lines = [
    `# OpenReview notes for ${title}`,
    "",
    `- OpenReview forum: https://openreview.net/forum?id=${forum}`,
    `- Matched title: ${value(submission.content?.title) || ""}`,
    `- Match score: ${candidates[0].score.toFixed(2)}`,
    "",
  ]
  if (!interesting.length) {
    lines.push("No public review/rebuttal/decision notes found in the matched forum.")
  } else {
    for (const note of interesting) {
      lines.push(`## ${note.invitation || note.id}`, "")
      lines.push(noteText(note) || "(no text fields extracted)", "")
    }
  }
  fs.writeFileSync(outPath, lines.join("\n").trim() + "\n")
  meta.openreview = {
    forum,
    url: `https://openreview.net/forum?id=${forum}`,
    match_score: Number(candidates[0].score.toFixed(3)),
    notes_count: interesting.length,
    local_path: "reviews/openreview.md",
  }
  writeJson(metaPath, meta)
  console.log(`${paperKey}: matched OpenReview forum ${forum}; public notes=${interesting.length}`)
}

const keys = all
  ? fs.readdirSync(PAPERS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [key]
for (const k of keys) {
  try {
    await fetchForPaper(k)
  } catch (err) {
    console.error(`${k}: ${err.message || err}`)
  }
}
