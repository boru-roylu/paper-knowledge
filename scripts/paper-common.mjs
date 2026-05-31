import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

export const ROOT = process.cwd()
export const CONTENT = path.join(ROOT, "content")
export const PAPERS = path.join(CONTENT, "papers")
export const CACHE = path.join(ROOT, "cache")
export const QUEUE = path.join(ROOT, "queue")

export function ensureDirs() {
  for (const dir of [PAPERS, CACHE, QUEUE, path.join(CACHE, "arxiv")]) fs.mkdirSync(dir, { recursive: true })
}

export function parseArxivId(input) {
  const text = String(input).trim()
  const m = text.match(/(?:arxiv\.org\/(?:abs|pdf|src)\/)?([0-9]{4}\.[0-9]{4,5})(v[0-9]+)?(?:\.pdf)?/i)
  if (!m) return null
  return { id: m[1], version: m[2] || "" }
}

export function paperKeyFromArxiv(id) {
  return `arxiv_${id.replace(".", "_")}`
}

export async function fetchText(url, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "user-agent": "paper-knowledge/0.1 roylu" } })
    if (res.ok) return await res.text()
    last = res
    if (![429, 500, 502, 503, 504].includes(res.status) || i === tries - 1) break
    await new Promise((resolve) => setTimeout(resolve, 3000 * (i + 1)))
  }
  throw new Error(`fetch failed ${last?.status}: ${url}`)
}

function xmlText(entry, tag) {
  const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))
  return m ? decodeXml(m[1].replace(/\s+/g, " ").trim()) : ""
}

function decodeXml(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
}

export async function getArxivMetadata(id) {
  const xml = await fetchText(`https://export.arxiv.org/api/query?id_list=${id}`)
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/i)?.[1]
  if (!entry) throw new Error(`No arXiv API entry for ${id}`)
  const authors = [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/gi)].map((m) => decodeXml(m[1].replace(/\s+/g, " ").trim()))
  const primaryClass = entry.match(/arxiv:primary_category[^>]*term="([^"]+)"/i)?.[1] || ""
  const published = xmlText(entry, "published")
  const updated = xmlText(entry, "updated")
  return {
    title: xmlText(entry, "title"),
    summary: xmlText(entry, "summary"),
    authors,
    year: Number((published || updated).slice(0, 4)) || new Date().getFullYear(),
    published,
    updated,
    primaryClass,
    categories: [...entry.matchAll(/<category[^>]*term="([^"]+)"/gi)].map((m) => m[1]),
  }
}

export function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, stdio: opts.stdio || "pipe", encoding: "utf8" })
}

export function extractArchive(archive, dest) {
  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(dest, { recursive: true })
  run("tar", ["-xzf", archive, "-C", dest])
  const files = listFiles(dest)
  if (!files.some((f) => /\.(tex|bbl|bib|ltx)$/i.test(f))) throw new Error(`No TeX-like files found after extracting ${archive}`)
}

export function listFiles(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...listFiles(p))
    else out.push(p)
  }
  return out
}

export function findEntrypoint(sourceDir) {
  const readme = path.join(sourceDir, "00README.json")
  if (fs.existsSync(readme)) {
    try {
      const data = JSON.parse(fs.readFileSync(readme, "utf8"))
      const top = data.sources?.find((s) => s.usage === "toplevel")?.filename
      if (top && fs.existsSync(path.join(sourceDir, top))) return path.join(sourceDir, top)
    } catch {}
  }
  const tex = listFiles(sourceDir).filter((f) => f.endsWith(".tex"))
  return tex.find((f) => /(^|\/)(main|paper|article|ms|v[0-9]+)\.tex$/i.test(f)) || tex[0] || null
}

export function yamlString(s) {
  return JSON.stringify(String(s ?? ""))
}

export function shortTags(meta) {
  const tags = new Set(["speech-llm"])
  const text = `${meta.title} ${meta.summary}`.toLowerCase()
  if (/audio reasoning|reasoning/.test(text)) tags.add("audio-reasoning")
  if (/tts|text-to-speech/.test(text)) tags.add("tts")
  if (/asr|transcri/.test(text)) tags.add("asr")
  if (/diari/.test(text)) tags.add("diarization")
  if (/full-duplex|duplex|turn-taking|backchannel|overlap/.test(text)) tags.add("full-duplex")
  if (/data|dataset|preprocess|pipeline|clean/.test(text)) tags.add("speech-data")
  if (/full-duplex|duplex|backchannel|overlap|spoken interaction|audio-to-speech/.test(text)) tags.add("project-full-duplex-data")
  if (/tts|asr|transcri|overlap|preprocess|clean|data|dataset/.test(text)) tags.add("project-tts-data-pipeline")
  return [...tags]
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n")
}


export function todayPacific() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return values.year + "-" + values.month + "-" + values.day
}
