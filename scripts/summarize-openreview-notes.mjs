import fs from "node:fs"
import path from "node:path"
import { PAPERS, writeJson, listFiles } from "./paper-common.mjs"

const key = process.argv[2]
const all = process.argv.includes("--all")
if (!key && !all) throw new Error("Usage: node scripts/summarize-openreview-notes.mjs <paper_key>|--all")
const model = process.env.OPENREVIEW_SUMMARY_MODEL || "gpt-5.5"

function loadGatewayEnv() {
  const envPath = path.join(process.env.HOME || "/home/openclaw", ".config/openclaw/gateway.env")
  if (!process.env.OPENAI_API_KEY && fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^OPENAI_API_KEY=(.*)$/)
      if (m) process.env.OPENAI_API_KEY = m[1].replace(/^"|"$/g, "")
    }
  }
}

const retryMax = Number(process.env.PAPER_LLM_RETRY_MAX || 6)
const retryBaseMs = Number(process.env.PAPER_LLM_RETRY_BASE_MS || 2000)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelayMs(status, body, headers, attempt) {
  const retryAfter = Number(headers?.get?.("retry-after") || 0)
  if (retryAfter > 0) return Math.ceil(retryAfter * 1000)
  const ms = String(body || "").match(/try again in\s+(\d+)\s*ms/i)?.[1]
  if (ms) return Number(ms) + 750
  const seconds = String(body || "").match(/try again in\s+([0-9.]+)\s*s/i)?.[1]
  if (seconds) return Math.ceil(Number(seconds) * 1000) + 750
  const exp = retryBaseMs * 2 ** Math.max(0, attempt - 1)
  const jitter = Math.floor(Math.random() * 750)
  return Math.min(60000, exp + jitter)
}

function shouldRetry(status, body) {
  const text = String(body || "")
  return status === 429 || status >= 500 || /rate_limit_exceeded|temporarily|overloaded/i.test(text)
}

async function callOpenAI(input) {
  loadGatewayEnv()
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not available")
  for (let attempt = 1; attempt <= retryMax; attempt++) {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model, input, max_output_tokens: 1800 }),
    })
    const body = await res.text()
    if (res.ok) {
      const json = JSON.parse(body)
      if (json.output_text) return json.output_text
      const texts = []
      for (const item of json.output || []) for (const c of item.content || []) if (c.text) texts.push(c.text)
      return texts.join("\n").trim()
    }
    if (attempt >= retryMax || !shouldRetry(res.status, body)) {
      throw new Error(`OpenAI ${res.status}: ${body.slice(0, 500)}`)
    }
    const delay = retryDelayMs(res.status, body, res.headers, attempt)
    console.error(`OpenAI ${res.status}; retrying OpenReview summary with ${model} in ${Math.round(delay / 1000)}s (${attempt}/${retryMax})`)
    await sleep(delay)
  }
  throw new Error("OpenAI retry loop exhausted")
}

function texExcerpt(paperDir, meta) {
  const sourceDir = path.join(paperDir, meta.local_paths?.source_dir || "source")
  const entry = meta.local_paths?.entrypoint ? path.join(paperDir, meta.local_paths.entrypoint) : null
  const files = []
  if (entry && fs.existsSync(entry)) files.push(entry)
  for (const f of listFiles(sourceDir).filter((p) => p.endsWith(".tex"))) if (!files.includes(f)) files.push(f)
  const text = files.slice(0, 6).map((f) => fs.readFileSync(f, "utf8")).join("\n\n").replace(/^%.*$/gm, "")
  const titleIntro = text.slice(0, 14000)
  const method = text.match(/\\section\*?\{(?:Method|Methods|Approach|System|Proposed Method)[^}]*\}([\s\S]{0,12000})/i)?.[0] || ""
  const experiments = text.match(/\\section\*?\{(?:Experiment|Experiments|Evaluation|Results)[^}]*\}([\s\S]{0,12000})/i)?.[0] || ""
  const limitations = text.match(/\\section\*?\{(?:Limitations|Discussion|Conclusion|Conclusions)[^}]*\}([\s\S]{0,9000})/i)?.[0] || ""
  return `${titleIntro}\n\n${method}\n\n${experiments}\n\n${limitations}`.slice(0, 38000)
}

async function summarize(paperKey) {
  const paperDir = path.join(PAPERS, paperKey)
  const metaPath = path.join(paperDir, "metadata.json")
  const reviewPath = path.join(paperDir, "reviews", "openreview.md")
  if (!fs.existsSync(metaPath) || !fs.existsSync(reviewPath)) return
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"))
  const raw = fs.readFileSync(reviewPath, "utf8")
  const outPath = path.join(paperDir, "reviews", "openreview-summary.md")
  let body
  if (/No public review\/rebuttal\/decision notes found/i.test(raw)) {
    body = [
      `# OpenReview Summary: ${meta.title}`,
      "",
      `- Forum: ${meta.openreview?.url || ""}`,
      "- Public review/rebuttal/decision notes: none found",
      "",
      "未找到公開 OpenReview review / rebuttal / decision context。這個 forum 目前只能作為 OpenReview archive/reference link。",
      "",
    ].join("\n")
  } else {
    const tex = texExcerpt(paperDir, meta)
    const prompt = `你是研究助理。請把下面 OpenReview notes 整理成 Traditional Chinese review summary，保留 technical terms in English。
你必須同時對照 paper TeX excerpts，判斷 reviewer criticism 是否合理、作者 rebuttal 是否有真的回答問題、以及這些 criticism 對讀 paper / 後續研究的影響。

請輸出 Markdown，包含：
## Verdict
## Main Strengths
## Main Weaknesses
## Reviewer Questions
## Author Rebuttal
## Criticism vs Paper Evidence
## What This Changes When Reading The Paper

Paper title: ${meta.title}

Paper TeX excerpts:
${tex}

OpenReview notes:
${raw.slice(0, 30000)}`
    body = `# OpenReview Summary: ${meta.title}\n\n` + (await callOpenAI(prompt)).trim() + "\n"
  }
  fs.writeFileSync(outPath, body)
  meta.openreview = {
    ...(meta.openreview || {}),
    summary_local_path: "reviews/openreview-summary.md",
    summary_model: model,
  }
  writeJson(metaPath, meta)
  console.log(`${paperKey}: wrote reviews/openreview-summary.md`)
}

const keys = all
  ? fs.readdirSync(PAPERS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [key]
for (const k of keys) {
  try {
    await summarize(k)
  } catch (err) {
    console.error(`${k}: ${err.message || err}`)
  }
}
