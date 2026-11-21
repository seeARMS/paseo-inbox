# Paseo Inbox

A Paseo plugin that gives your agents an inbox for things they need from you. Agents file action items with buttons; pressing one sends its message back to the same agent, Edit opens the agent's chat with a suggested reply, and History keeps a record of every decision.

See [OVERVIEW.md](OVERVIEW.md) for how it works.

## Install

```bash
paseo plugin add seeARMS/paseo-inbox
```

Or straight from GitHub:

```bash
paseo plugin add git:seeARMS/paseo-inbox
```

Requires Paseo 0.17.0-beta.1 or later.

## Using it from prompts and schedules

Agents get `inbox_add`, `inbox_list` and `inbox_resolve` automatically. To control what gets filed, name them in a schedule prompt, for example:

> For each draft, call `inbox_add` with title "Send follow-up to <name>?", dedupeKey "followup:<lead id>", the draft in the body, and two actions: "Send it" (message: "Approved: send the follow-up to <name> exactly as written: …") and "Skip".

A button press arrives in the agent's chat as a message starting with `[Inbox: <title>]`.

## Development

```bash
npm install
npm run typecheck
paseo plugin install "$PWD"
paseo plugin reload paseo-inbox
```

## License

MIT
