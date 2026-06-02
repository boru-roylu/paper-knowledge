import fs from "node:fs"
import path from "node:path"
import { PAPERS, CONTENT, listFiles, yamlString, todayPacific } from "./paper-common.mjs"

const args = process.argv.slice(2)
const idea = args.includes("--idea") ? args[args.indexOf("--idea") + 1] : args.join(" ")
if (!idea) throw new Error("Usage: node scripts/create-project-draft.mjs --idea <motivation/high-level idea>")
const model = process.env.PROJECT_DRAFT_MODEL || process.env.PAPER_SUMMARY_MODEL || "gpt-5.4-mini"

function slugify(s) {
  return String(s || "project-draft").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "project-draft"
}

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

async function callOpenAI(input, maxOutput = 2200) {
  loadGatewayEnv()
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not available")
  for (let attempt = 1; attempt <= retryMax; attempt++) {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model, input, max_output_tokens: maxOutput }),
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
    console.error(`OpenAI ${res.status}; retrying project draft with ${model} in ${Math.round(delay / 1000)}s (${attempt}/${retryMax})`)
    await sleep(delay)
  }
  throw new Error("OpenAI retry loop exhausted")
}

function stripFrontmatter(md) {
  return String(md || "").replace(/^---[\s\S]*?---/, "").trim()
}

function section(md, heading) {
  const re = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`, "i")
  return md.match(re)?.[1]?.trim() || ""
}

function texExcerpt(paperDir, meta) {
  const sourceDir = path.join(paperDir, meta.local_paths?.source_dir || "source")
  const entry = meta.local_paths?.entrypoint ? path.join(paperDir, meta.local_paths.entrypoint) : null
  const files = []
  if (entry && fs.existsSync(entry)) files.push(entry)
  for (const f of listFiles(sourceDir).filter((p) => p.endsWith(".tex"))) if (!files.includes(f)) files.push(f)
  const text = files.slice(0, 5).map((f) => fs.readFileSync(f, "utf8")).join("\n\n").replace(/^%.*$/gm, "")
  const intro = text.match(/\\section\*?\{(?:Introduction|Intro)[^}]*\}([\s\S]{0,9000})/i)?.[0] || text.slice(0, 9000)
  const methods = text.match(/\\section\*?\{(?:Method|Methods|Approach|Proposed Method)[^}]*\}([\s\S]{0,9000})/i)?.[0] || ""
  const limitations = text.match(/\\section\*?\{(?:Limitations|Discussion|Conclusion|Conclusions)[^}]*\}([\s\S]{0,7000})/i)?.[0] || ""
  return `${intro}\n\n${methods}\n\n${limitations}`.slice(0, 18000)
}

const papers = []
for (const dir of fs.readdirSync(PAPERS, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue
  const paperDir = path.join(PAPERS, dir.name)
  const metaPath = path.join(paperDir, "metadata.json")
  const indexPath = path.join(paperDir, "index.md")
  if (!fs.existsSync(metaPath) || !fs.existsSync(indexPath)) continue
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"))
  const md = stripFrontmatter(fs.readFileSync(indexPath, "utf8"))
  papers.push({
    key: dir.name,
    title: meta.title || dir.name,
    year: meta.year || "",
    tags: meta.tags || [],
    summary: [
      section(md, "一句話總結"),
      section(md, "這篇在解決什麼問題"),
      section(md, "核心方法"),
      section(md, "可能的弱點 / open questions"),
      section(md, "Related papers in my pool"),
    ].filter(Boolean).join("\n").slice(0, 2200),
  })
}

const shortlistPrompt = `You are helping create a research project draft. Given the user's rough idea and existing paper summaries, pick only truly relevant papers.

Return strict JSON only:
{"title":"short project title","slug":"short-url-slug","papers":[{"key":"paper_key","relevance":1-5,"reason":"one sentence"}]}

User idea:
${idea}

Existing paper summaries:
${papers.map((p) => `KEY=${p.key}\nTITLE=${p.title} (${p.year})\nTAGS=${p.tags.join(", ")}\n${p.summary}`).join("\n\n---\n\n").slice(0, 30000)}`

let shortlist
try {
  shortlist = JSON.parse(await callOpenAI(shortlistPrompt, 1200))
} catch (err) {
  throw new Error(`failed to create shortlist JSON: ${err.message || err}`)
}

const selectedKeys = new Set((shortlist.papers || []).filter((p) => Number(p.relevance) >= 3).slice(0, 6).map((p) => p.key))
const selected = papers.filter((p) => selectedKeys.has(p.key))
const deep = selected.map((p) => {
  const paperDir = path.join(PAPERS, p.key)
  const meta = JSON.parse(fs.readFileSync(path.join(paperDir, "metadata.json"), "utf8"))
  return `KEY=${p.key}\nTITLE=${p.title}\nSUMMARY=${p.summary}\nTEX_EXCERPT:\n${texExcerpt(paperDir, meta)}`
}).join("\n\n---\n\n")

const draftPrompt = `你是研究助理。請用 Traditional Chinese 產生一個 research project draft page。保留 technical terms in English。

這不是正式 project，是 brainstorming / project draft。請明確分開 user idea、motivation、可能 research questions、related papers、possible experiments、risks/open questions、next steps。

必須包含以下 sections：
## Idea
## Motivation
## Working Hypothesis
## Related Papers
## Possible Approach
## Possible Experiments
## Risks / Open Questions
## Next Steps

User idea:
${idea}

Shortlist:
${JSON.stringify(shortlist, null, 2)}

Deep paper context:
${deep || "(no strongly related papers selected)"}`

const title = shortlist.title || "Project Draft"
const slug = slugify(shortlist.slug || title)
const baseDir = path.join(CONTENT, "brainstorming")
let outDir = path.join(baseDir, slug)
let suffix = 2
while (fs.existsSync(outDir)) outDir = path.join(baseDir, `${slug}-${suffix++}`)
fs.mkdirSync(outDir, { recursive: true })
const body = await callOpenAI(draftPrompt, 3000)
const frontmatter = [
  "---",
  `title: ${yamlString(title)}`,
  "draft_type: brainstorming",
  `created: ${todayPacific()}`,
  `model: ${model}`,
  "status: draft",
  "---",
  "",
].join("\n")
fs.writeFileSync(path.join(outDir, "index.md"), frontmatter + body.trim() + "\n")
fs.writeFileSync(path.join(outDir, "input.md"), `# Raw idea\n\n${idea}\n\n# Shortlist\n\n\`\`\`json\n${JSON.stringify(shortlist, null, 2)}\n\`\`\`\n`)
console.log(`created ${path.relative(process.cwd(), outDir)}/index.md`)
