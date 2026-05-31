import fs from "node:fs"
import path from "node:path"

const nav = '<div class="paper-nav"><a href="../../">&larr; Papers</a></div>'
const papersDir = path.resolve('content/papers')
for (const dirent of fs.readdirSync(papersDir, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue
  const file = path.join(papersDir, dirent.name, 'index.md')
  if (!fs.existsSync(file)) continue
  let text = fs.readFileSync(file, 'utf8')
  text = text.replace(/\n?<div class="paper-nav">[\s\S]*?<\/div>\n?/g, '\n')
  text = text.replace(/^(---\n[\s\S]*?\n---\n)/, `$1\n${nav}\n\n`)
  fs.writeFileSync(file, text)
}
