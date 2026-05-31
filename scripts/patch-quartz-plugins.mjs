import fs from "node:fs"
import path from "node:path"

function patchFile(file, transforms) {
  if (!fs.existsSync(file)) return false
  let text = fs.readFileSync(file, "utf8")
  const before = text
  for (const transform of transforms) text = transform(text)
  if (text !== before) fs.writeFileSync(file, text)
  return true
}

function lines(parts) {
  return parts.join("\n")
}

function patchGraphText(text) {
  if (!text.includes('data.delete("index")')) {
    text = text.replace(
      lines([
        '        for (var key in dataRaw) {',
        '          data.set(simplifySlug(key), dataRaw[key]);',
        '        }',
      ]),
      lines([
        '        for (var key in dataRaw) {',
        '          data.set(simplifySlug(key), dataRaw[key]);',
        '        }',
        '        data.delete("index");',
        '        data.delete("");',
        '        if ((slug === "index" || slug === "") && depth >= 0) depth = -1;',
      ]),
    )
  }
  if (!text.includes('dest === ""')) {
    text = text.replace(
      lines([
        '          var dest = simplifySlug(outgoing[i]);',
        '          if (validLinks.has(dest)) {',
      ]),
      lines([
        '          var dest = simplifySlug(outgoing[i]);',
        '          if (source === "index" || source === "" || dest === "index" || dest === "") continue;',
        '          if (validLinks.has(dest)) {',
      ]),
    )
  }
  if (!text.includes('!tag.startsWith("project-")')) {
    text = text.replace(
      lines([
        '            var tag = tags[i];',
        '            if (removeTags.indexOf(tag) === -1) {',
      ]),
      lines([
        '            var tag = tags[i];',
        '            if (!tag.startsWith("project-")) continue;',
        '            if (removeTags.indexOf(tag) === -1) {',
      ]),
    )
  }
  return text
}

function patchExplorerText(text) {
  if (!text.includes('node.displayName = "Projects"')) {
    text = text.replace(
      lines([
        '  mapFn: (node) => {',
        '    return node;',
        '  },',
      ]),
      lines([
        '  mapFn: (node) => {',
        '    if (node.slugSegment === "tags") node.displayName = "Projects";',
        '    return node;',
        '  },',
      ]),
    )
  }
  if (!text.includes('slug.startsWith("tags/project-")')) {
    text = text.replace(
      '  filterFn: (node) => node.slugSegment !== "tags",',
      lines([
        '  filterFn: (node) => {',
        '    const slug = String(node.slug ?? "").replace(/\\/index$/, "");',
        '    if (node.slugSegment === "tags") return true;',
        '    if (slug.startsWith("tags/")) return slug.startsWith("tags/project-");',
        '    return true;',
        '  },',
      ]),
    )
  }
  return text
}

const files = [
  [".quartz/plugins/graph/src/components/scripts/graph.inline.ts", patchGraphText],
  [".quartz/plugins/graph/dist/index.js", patchGraphText],
  [".quartz/plugins/graph/dist/components/index.js", patchGraphText],
  [".quartz/plugins/explorer/src/components/Explorer.tsx", patchExplorerText],
  [".quartz/plugins/explorer/dist/index.js", patchExplorerText],
  [".quartz/plugins/explorer/dist/components/index.js", patchExplorerText],
]

let found = 0
for (const [file, transform] of files) {
  if (patchFile(path.resolve(file), [transform])) found++
}
if (found === 0) {
  console.warn("No Quartz plugin files found to patch; install plugins before build if this is a clean checkout.")
}
