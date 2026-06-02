import { spawnSync } from "node:child_process"

const remote = process.env.PAPER_REMOTE || "paper"
const publishBranch = process.env.PAPER_PUBLISH_BRANCH || "paper-site"
const remoteBranch = process.env.PAPER_REMOTE_BRANCH || "main"
const doBuild = !process.argv.includes("--no-build")
const messageArg = process.argv.includes("--message") ? process.argv[process.argv.indexOf("--message") + 1] : ""

function run(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...options })
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed with exit code ${res.status}`)
  }
}

function output(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: "utf8" })
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${res.stderr || res.stdout}`)
  }
  return res.stdout.trim()
}

function hasGitChanges() {
  return output("git", ["status", "--porcelain"]).length > 0
}

function pacificTimestamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date())
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute} PT`
}

if (doBuild) {
  run("npm", ["run", "build:papers"])
}

if (!hasGitChanges()) {
  console.log("paper site is already up to date")
  process.exit(0)
}

run("git", [
  "add",
  "-A",
  "content",
  "scripts",
  "package.json",
  ".gitignore",
  "quartz.config.yaml",
  "quartz.config.default.yaml",
  "quartz.lock.json",
  "quartz.ts",
])

if (output("git", ["diff", "--cached", "--name-only"]).length === 0) {
  console.log("no publishable changes after staging")
  process.exit(0)
}

const message = messageArg || `Update paper knowledge ${pacificTimestamp()}`
run("git", ["commit", "-m", message])

const currentBranch = output("git", ["branch", "--show-current"])
if (currentBranch === publishBranch) {
  run("git", ["push", remote, `${publishBranch}:${remoteBranch}`])
  run("git", ["push", remote, `${publishBranch}:${publishBranch}`])
  console.log(`published ${output("git", ["rev-parse", "--short=12", "HEAD"])} to ${remote}/${remoteBranch}`)
  process.exit(0)
}

const tree = output("git", ["rev-parse", "HEAD^{tree}"])
let parent = ""
try {
  parent = output("git", ["rev-parse", "--verify", publishBranch])
} catch {
  // First publish on a new machine.
}

const commitArgs = parent ? ["commit-tree", tree, "-p", parent, "-m", message] : ["commit-tree", tree, "-m", message]
const publishCommit = output("git", commitArgs)

run("git", ["branch", "-f", publishBranch, publishCommit])
run("git", ["push", remote, `${publishBranch}:${remoteBranch}`])
run("git", ["push", remote, `${publishBranch}:${publishBranch}`])

console.log(`published ${publishCommit.slice(0, 12)} to ${remote}/${remoteBranch}`)
