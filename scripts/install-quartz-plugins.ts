import fs from "node:fs"
import YAML from "yaml"
import { installPlugins, parsePluginSource } from "../quartz/plugins/loader/gitLoader"

const configPath = fs.existsSync("quartz.config.yaml")
  ? "quartz.config.yaml"
  : "quartz.config.default.yaml"

const raw = fs.readFileSync(configPath, "utf8")
const config = YAML.parse(raw)
const entries = Array.isArray(config?.plugins) ? config.plugins : []
const sources = [...new Set(entries.map((entry) => entry?.source).filter(Boolean))]

if (sources.length === 0) {
  console.log("No Quartz plugins found in config.")
  process.exit(0)
}

console.log(`Installing ${sources.length} Quartz plugin(s) from ${configPath}...`)
const specs = sources.map((source) => parsePluginSource(source))
const installed = await installPlugins(specs, { verbose: true })

if (installed.size !== specs.length) {
  throw new Error(`Only installed ${installed.size}/${specs.length} Quartz plugins`)
}

console.log("Quartz plugins installed.")
