# Herdr OMO Agent

Register [OmO](https://github.com/code-yeongyu/oh-my-openagent) sessions as coding agents in [Herdr](https://github.com/herdrdev/herdr).

The plugin reports the canonical Herdr agent identity as `omo`. This keeps OmO sessions identifiable in pane borders, agent lists, and `herdr agent` targets instead of being claimed as Cursor (from a nested `cursor-agent` helper) or Pi.

## Requirements

- OmO
- Herdr 0.8.3+ with native `omo` agent detection, or a local Herdr build that includes `Agent::Omo`
- macOS or Linux for automatic discovery of sessions that were already running

## Install

```sh
omo install https://github.com/islee23520/herdr-omo-agent
```

Start OmO inside a Herdr pane as usual:

```sh
omo
```

The extension automatically reports:

- `working` when an OmO turn starts
- `idle` when an OmO turn settles
- `omo` as the canonical Herdr agent

## Already-running OmO sessions

Installation updates OmO settings. When any running OmO session reloads the changed settings, the plugin discovers every local OmO process carrying a `HERDR_PANE_ID` and repairs all of those panes without restarting them.

If automatic config reload is deferred because a turn or subagent is active, run this after the session becomes idle:

```text
/reload
```

Only one OmO session needs to load the plugin; it repairs the other running OmO panes too.

## Verify

```sh
herdr agent list
```

Expected shape:

```text
omo: [w1:p2] (idle) /path/to/project
```

The underlying record uses `agent: omo`.

## Update

```sh
omo update https://github.com/islee23520/herdr-omo-agent
```

## Remove

```sh
omo remove https://github.com/islee23520/herdr-omo-agent
```

## Development

```sh
bun test
npm run check
```

## License

MIT
