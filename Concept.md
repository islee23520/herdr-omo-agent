# Herdr OMO Agent

Herdr OMO Agent is an installable OmO extension that reports OmO sessions to Herdr using the canonical `omo` agent identity.

## Stack

- JavaScript ES modules
- OmO/Pi extension API
- Herdr CLI
- Bun test runner

## Installation contract

```sh
omo install https://github.com/islee23520/herdr-omo-agent
```

New and reloaded OmO sessions report lifecycle state automatically. The bundled `herdr-omo-register` command repairs recognition for OmO sessions that were already running before installation.
