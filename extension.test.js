import { describe, expect, test } from "bun:test"

import { createHerdrOmoAgentExtension, findOmoPaneIds } from "./extension.js"

function fakePi(processList = "") {
  const calls = []
  const handlers = new Map()
  return {
    calls,
    handlers,
    api: {
      exec: async (command, args) => {
        calls.push({ command, args })
        if (command === "ps") return { code: 0, stdout: processList, stderr: "" }
        if (args[1] === "get") {
          return {
            code: 0,
            stdout: JSON.stringify({ result: { pane: { agent_status: "working" } } }),
            stderr: "",
          }
        }
        return { code: 0, stdout: "", stderr: "" }
      },
      on: (event, handler) => handlers.set(event, handler),
    },
  }
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve))
}

describe("findOmoPaneIds", () => {
  test("extracts unique Herdr panes from OmO processes only", () => {
    const processList = [
      "node /opt/homebrew/bin/omo HERDR_PANE_ID=w1:p2 HERDR_ENV=1",
      "node /opt/homebrew/bin/omo HERDR_PANE_ID=w1:p2 HERDR_ENV=1",
      "/usr/local/bin/omo HERDR_PANE_ID=w2:p3 HERDR_ENV=1",
      "node /tmp/omomo HERDR_PANE_ID=w9:p9",
      "node /opt/homebrew/bin/pi HERDR_PANE_ID=w3:p4",
    ].join("\n")

    expect(findOmoPaneIds(processList)).toEqual(["w1:p2", "w2:p3"])
  })
})

describe("herdr-omo-agent", () => {
  test("registers the current and already-running OmO panes as pi", async () => {
    const fixture = fakePi(
      "node /opt/homebrew/bin/omo HERDR_PANE_ID=w1:p2\n" +
        "node /opt/homebrew/bin/omo HERDR_PANE_ID=w2:p3",
    )

    createHerdrOmoAgentExtension({
      HERDR_BIN_PATH: "/opt/herdr",
      HERDR_ENV: "1",
      HERDR_PANE_ID: "w1:p2",
    })(fixture.api)

    await settle()
    await settle()

    expect(fixture.calls).toContainEqual({
      command: "/opt/herdr",
      args: [
        "pane",
        "report-agent",
        "w1:p2",
        "--source",
        "herdr-omo-agent",
        "--agent",
        "pi",
        "--state",
        "idle",
      ],
    })
    expect(fixture.calls).toContainEqual({
      command: "/opt/herdr",
      args: [
        "pane",
        "report-agent",
        "w2:p3",
        "--source",
        "herdr-omo-agent",
        "--agent",
        "pi",
        "--state",
        "working",
      ],
    })
    expect(fixture.calls).toContainEqual({
      command: "/opt/herdr",
      args: [
        "pane",
        "report-metadata",
        "w2:p3",
        "--source",
        "herdr-omo-agent:display-herdr-pi",
        "--agent",
        "pi",
        "--applies-to-source",
        "herdr:pi",
        "--display-agent",
        "omo",
        "--ttl-ms",
        "86400000",
      ],
    })
  })

  test("reports lifecycle transitions for the current session", async () => {
    const fixture = fakePi()
    createHerdrOmoAgentExtension({
      HERDR_BIN_PATH: "/opt/herdr",
      HERDR_ENV: "1",
      HERDR_PANE_ID: "w1:p2",
    })(fixture.api)
    await settle()
    fixture.calls.length = 0

    await fixture.handlers.get("agent_start")()
    await fixture.handlers.get("agent_settled")()
    await fixture.handlers.get("session_shutdown")()

    expect(fixture.calls.filter((call) => call.args[1] === "report-agent")).toEqual([
      {
        command: "/opt/herdr",
        args: [
          "pane",
          "report-agent",
          "w1:p2",
          "--source",
          "herdr-omo-agent",
          "--agent",
          "pi",
          "--state",
          "working",
        ],
      },
      {
        command: "/opt/herdr",
        args: [
          "pane",
          "report-agent",
          "w1:p2",
          "--source",
          "herdr-omo-agent",
          "--agent",
          "pi",
          "--state",
          "idle",
        ],
      },
      {
        command: "/opt/herdr",
        args: [
          "pane",
          "report-agent",
          "w1:p2",
          "--source",
          "herdr-omo-agent",
          "--agent",
          "pi",
          "--state",
          "idle",
        ],
      },
    ])
  })

  test("does not activate outside Herdr", () => {
    const fixture = fakePi()
    createHerdrOmoAgentExtension({ HERDR_ENV: "0" })(fixture.api)

    expect(fixture.calls).toEqual([])
    expect(fixture.handlers.size).toBe(0)
  })
})
