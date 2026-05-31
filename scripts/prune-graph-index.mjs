import fs from "node:fs"
import path from "node:path"

const indexPath = path.resolve("public/static/contentIndex.json")
if (!fs.existsSync(indexPath)) {
  process.exit(0)
}

const data = JSON.parse(fs.readFileSync(indexPath, "utf8"))
const homeSlugs = new Set(["", "/", "index", "index/", "papers", "papers/", "papers/index", "papers/index/"])

function keepGraphSlug(slug) {
  const s = String(slug).replace(/\/$/, "")
  if (homeSlugs.has(s)) return false
  if (s.startsWith("tags/") && !s.startsWith("tags/project-")) return false
  return true
}

for (const key of Object.keys(data)) {
  const entry = data[key]
  if (!keepGraphSlug(key) || entry?.title === "Paper Knowledge" || entry?.title === "papers") {
    delete data[key]
    continue
  }
  if (Array.isArray(entry?.links)) {
    entry.links = entry.links.filter((link) => keepGraphSlug(link))
  }
}

fs.writeFileSync(indexPath, JSON.stringify(data))


const cacheBust = Date.now().toString()
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name)
    const stat = fs.statSync(file)
    if (stat.isDirectory()) walk(file)
    else if (file.endsWith(".html")) {
      let html = fs.readFileSync(file, "utf8")
      html = html.replace(/static\/contentIndex\.json(?:\?v=\d+)?/g, `static/contentIndex.json?v=${cacheBust}`)
      fs.writeFileSync(file, html)
    }
  }
}
walk(path.resolve("public"))
