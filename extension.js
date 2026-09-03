const AGENT = "pi"
const DISPLAY_AGENT = "omo"
const SOURCE = "herdr-omo-agent"
const DISPLAY_SOURCE = "herdr-omo-agent:display"
const INTEGRATION_DISPLAY_SOURCE = "herdr-omo-agent:display-herdr-pi"
const INTEGRATION_SOURCE = "herdr:pi"
const LEGACY_AGENT = "omo"
const LEGACY_SOURCES = ["user:omo", SOURCE]
const DISPLAY_TTL_MS = "86400000"

function herdrEnvironment(environment) {
  const binPath = environment.HERDR_BIN_PATH || "herdr"
  const paneId = environment.HERDR_PANE_ID
  if (environment.HERDR_ENV !== "1" || !paneId) return undefined
  return { binPath, paneId }
}

export function findOmoPaneIds(processList) {
  const paneIds = new Set()
  for (const line of processList.split("\n")) {
    const command = line.match(/(?:^|\s)(?:node\s+)?([^\s]*\/)?omo(?:\s|$)/)
    if (!command) continue
    const match = line.match(/(?:^|\s)HERDR_PANE_ID=([^\s]+)/)
    if (match) paneIds.add(match[1])
  }
  return [...paneIds]
}

export function createHerdrOmoAgentExtension(environment = process.env) {
  return function registerHerdrOmoAgent(pi) {
    const herdr = herdrEnvironment(environment)
    if (!herdr) return

    async function exec(command, args) {
      try {
        return await pi.exec(command, args)
      } catch {
        return undefined
      }
    }

    async function invoke(paneId, action, args) {
      return exec(herdr.binPath, ["pane", action, paneId, ...args])
    }

    async function publishDisplay(paneId, source, displaySource) {
      await invoke(paneId, "report-metadata", [
        "--source",
        displaySource,
        "--agent",
        AGENT,
        "--applies-to-source",
        source,
        "--display-agent",
        DISPLAY_AGENT,
        "--ttl-ms",
        DISPLAY_TTL_MS,
      ])
    }

    async function report(paneId, state) {
      await invoke(paneId, "report-agent", [
        "--source",
        SOURCE,
        "--agent",
        AGENT,
        "--state",
        state,
      ])
    }

    async function repairPane(paneId, state = "idle") {
      for (const source of LEGACY_SOURCES) {
        await invoke(paneId, "release-agent", ["--source", source, "--agent", LEGACY_AGENT])
      }
      await publishDisplay(paneId, SOURCE, DISPLAY_SOURCE)
      await publishDisplay(paneId, INTEGRATION_SOURCE, INTEGRATION_DISPLAY_SOURCE)
      await report(paneId, state)
    }

    async function paneState(paneId) {
      const result = await invoke(paneId, "get", [])
      try {
        const parsed = JSON.parse(result?.stdout || "")
        const state = parsed?.result?.pane?.agent_status
        return ["working", "blocked", "idle", "done"].includes(state) ? state : "idle"
      } catch {
        return "idle"
      }
    }

    async function repairRunningSessions() {
      if (process.platform === "win32") return
      const result = await exec("ps", ["eww", "-axo", "command"])
      for (const paneId of findOmoPaneIds(result?.stdout || "")) {
        await repairPane(paneId, await paneState(paneId))
      }
    }

    async function initialize() {
      await repairPane(herdr.paneId)
      await repairRunningSessions()
    }

    void initialize()

    pi.on("session_start", async (_event, context) => {
      if (context?.mode !== "tui") return
      await repairPane(herdr.paneId)
      await repairRunningSessions()
    })
    pi.on("agent_start", () => report(herdr.paneId, "working"))
    pi.on("agent_settled", () => report(herdr.paneId, "idle"))
    pi.on("session_shutdown", async () => {
      await report(herdr.paneId, "idle")
      await invoke(herdr.paneId, "release-agent", ["--source", SOURCE, "--agent", AGENT])
    })
  }
}

export default createHerdrOmoAgentExtension()
