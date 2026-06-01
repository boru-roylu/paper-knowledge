import fs from "node:fs"
import path from "node:path"

const publicDir = path.resolve("public")
const pages = ["citation-graph"]

for (const page of pages) {
  const html = path.join(publicDir, `${page}.html`)
  if (!fs.existsSync(html)) continue
  const dir = path.join(publicDir, page)
  fs.mkdirSync(dir, { recursive: true })
  fs.copyFileSync(html, path.join(dir, "index.html"))
}
