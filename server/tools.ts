import { defineAgentTool } from "@getpaseo/plugin/server"
import { z } from "zod"
import type { InboxItem } from "../shared/inbox"
import { add, findItem, list, resolve } from "./store"

export const INBOX_INSTRUCTIONS = `## Inbox

When you are blocked on a decision or action only the person can take (approve a
message before it is sent, pick between options, sign in somewhere, review a
draft), call the Paseo tool \`inbox_add\` instead of only mentioning it in chat.
This matters most in scheduled or unattended runs, where nobody is reading the
chat. The item appears in the person's Inbox in Paseo.

- One item per decision. Write a title the person can act on without opening
  the body ("Send follow-up to Jane at Acme?"), and put the details, the draft,
  and links in the body (Markdown).
- Offer 1-3 \`actions\`. Each action's \`message\` is sent back to you as the
  person's reply when they press it, so write it as a complete instruction
  ("Approved. Send the follow-up as drafted."). Add \`draft\` when the person may
  want to edit a reply instead; it is pre-filled in your chat.
- Pass a stable \`dedupeKey\` (such as "follow-up:jane@acme.com") when a later run
  might raise the same item, so it updates the open item instead of adding another.
- Only ask for what you can't find out yourself. If you can check a fact (in
  the browser, a CRM, an API), check it instead of asking.
- After filing, end your turn or continue with other work. Do not wait or poll.
- When an item no longer needs the person (they did it themselves, or things
  changed), close it with \`inbox_resolve\` by id or dedupeKey. A later run can
  use \`inbox_list\` to see what is still open and what the person decided.
- Also close it with \`inbox_resolve\` and a short note when the person answers
  in chat instead of pressing a button, or when you finish or abandon the work
  the item was about. Don't leave an item open once nothing is waiting on them.
- A button press arrives as a message starting with "[Inbox: <title>]". It is
  the person's own decision for that item only. Presses can arrive while you
  are in the middle of other work, and several can arrive together: finish the
  step you are on, then handle each press on its own. A press never cancels
  what you were doing.`

export const inboxAdd = defineAgentTool({
  name: "inbox_add",
  title: "Add to inbox",
  description:
    "File an action item in the person's Paseo Inbox when you need their decision or manual action. Each action button sends its message back to you as a new turn.",
  input: z.object({
    title: z.string().min(1).max(200).describe("Short, actionable summary"),
    body: z.string().max(20_000).default("").describe("Markdown details"),
    source: z
      .string()
      .max(80)
      .optional()
      .describe(
        "The skill, schedule, or workflow filing this, e.g. 'linkedin-outreach'"
      ),
    links: z
      .array(z.object({ label: z.string(), url: z.string().url() }))
      .max(10)
      .default([]),
    actions: z
      .array(
        z.object({
          label: z.string().min(1).max(40).describe("Button text"),
          message: z
            .string()
            .min(1)
            .max(4000)
            .describe("Sent to you as the person's reply when pressed"),
        })
      )
      .max(4)
      .default([]),
    draft: z
      .string()
      .max(8000)
      .optional()
      .describe("Pre-filled in your chat when the person chooses Edit"),
    dedupeKey: z.string().max(200).optional(),
  }),
  async execute(input, { agent }) {
    const { item, updated } = await add({
      title: input.title,
      body: input.body,
      source: input.source ?? null,
      links: input.links,
      actions: input.actions,
      draft: input.draft ?? null,
      dedupeKey: input.dedupeKey ?? null,
      agentId: agent.id,
      agentTitle: agent.title,
      workspaceId: agent.workspaceId,
      cwd: agent.cwd,
    })
    return {
      text: `${updated ? "Updated" : "Added"} inbox item ${item.id}. The person's choice will arrive as a new message in this chat.`,
      structuredContent: { id: item.id, updated },
    }
  },
})

const refInput = {
  id: z.string().optional().describe("The item id inbox_add returned"),
  dedupeKey: z
    .string()
    .optional()
    .describe("The dedupeKey the item was filed with; use this from a later run"),
}

function describe(item: InboxItem) {
  const r = item.resolution
  return {
    id: item.id,
    dedupeKey: item.dedupeKey,
    status: item.status,
    title: item.title,
    source: item.source,
    createdAt: item.createdAt,
    resolution: r
      ? { kind: r.kind, label: r.label, at: r.at, delivery: r.delivery }
      : null,
  }
}

export const inboxResolve = defineAgentTool({
  name: "inbox_resolve",
  title: "Resolve inbox item",
  description:
    "Close an open inbox item because it no longer needs the person (for example, they already did it themselves, answered in chat instead of pressing a button, or the situation changed), or because you finished or abandoned the work it was about. Look it up by id or by its dedupeKey.",
  input: z.object({
    ...refInput,
    note: z
      .string()
      .max(1000)
      .optional()
      .describe("What happened, shown to the person in History"),
  }),
  async execute({ id, dedupeKey, note }) {
    if (!id && !dedupeKey) {
      return { text: "Pass an id or a dedupeKey.", isError: true }
    }
    const found = await findItem({ id, dedupeKey })
    if (!found) {
      return { text: `No inbox item matches ${id ?? dedupeKey}.`, isError: true }
    }
    if (found.status !== "open") {
      return {
        text: `Inbox item ${found.id} is already ${found.status}.`,
        structuredContent: describe(found),
      }
    }
    await resolve(found.id, "done", {
      kind: "agent",
      actionId: null,
      label: null,
      text: note ?? null,
    })
    return { text: `Resolved inbox item ${found.id}.` }
  },
})

export const inboxList = defineAgentTool({
  name: "inbox_list",
  title: "List inbox items",
  description:
    "List inbox items, newest first, to see what is still waiting on the person or what they decided. Filter by dedupeKey prefix (e.g. 'followup:') or source.",
  input: z.object({
    status: z.enum(["open", "closed", "all"]).default("open"),
    dedupeKeyPrefix: z.string().optional(),
    source: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async execute({ status, dedupeKeyPrefix, source, limit }) {
    const items = (await list())
      .filter((item) =>
        status === "all"
          ? true
          : status === "open"
            ? item.status === "open"
            : item.status !== "open"
      )
      .filter((item) =>
        dedupeKeyPrefix ? item.dedupeKey?.startsWith(dedupeKeyPrefix) : true
      )
      .filter((item) => (source ? item.source === source : true))
      .slice(0, limit)
      .map(describe)
    return {
      text: items.length
        ? JSON.stringify(items, null, 2)
        : "No matching inbox items.",
      structuredContent: { items },
    }
  },
})
