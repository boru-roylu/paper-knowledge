import fs from "node:fs"
import path from "node:path"

const papersDir = path.resolve("content/papers")
const start = "<!-- citation-graph:start -->"
const end = "<!-- citation-graph:end -->"
const re = new RegExp(`\\n?## Citation Graph\\n\\n${start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`, "m")

let count = 0
for (const dir of fs.readdirSync(papersDir, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue
  const indexPath = path.join(papersDir, dir.name, "index.md")
  if (!fs.existsSync(indexPath)) continue
  const before = fs.readFileSync(indexPath, "utf8")
  const after = before.replace(re, "\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
  if (after !== before) {
    fs.writeFileSync(indexPath, after)
    count++
  }
}
console.log(`removed per-paper citation graph blocks from ${count} papers`)
