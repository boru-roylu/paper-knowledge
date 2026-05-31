import fs from "node:fs"
import path from "node:path"

const tagsDir = path.resolve("public/tags")
if (!fs.existsSync(tagsDir)) process.exit(0)
for (const entry of fs.readdirSync(tagsDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".html") || entry.name === "index.html") continue
  const name = entry.name.slice(0, -".html".length)
  const dir = path.join(tagsDir, name)
  fs.mkdirSync(dir, { recursive: true })
  fs.copyFileSync(path.join(tagsDir, entry.name), path.join(dir, "index.html"))
}
