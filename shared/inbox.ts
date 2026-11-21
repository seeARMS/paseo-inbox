import { defineRpc, defineSubscription } from "@getpaseo/plugin"
import { z } from "zod"

export const actionSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Sent to the agent as a new turn when the button is pressed. */
  message: z.string(),
})
export type InboxAction = z.infer<typeof actionSchema>

export const resolutionSchema = z.object({
  kind: z.enum(["action", "edit", "dismissed", "agent"]),
  at: z.string(),
  actionId: z.string().nullable(),
  label: z.string().nullable(),
  /** The text sent to the agent, or the agent's note when it closed the item itself. */
  text: z.string().nullable(),
  /** For button presses: "queued" while the agent is busy, "sent" once delivered. */
  delivery: z.enum(["queued", "sent"]).nullable().default(null),
  deliveredAt: z.string().nullable().default(null),
})
export type InboxResolution = z.infer<typeof resolutionSchema>

export const itemSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(["open", "done", "dismissed"]),
  title: z.string(),
  body: z.string(),
  source: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  actions: z.array(actionSchema),
  draft: z.string().nullable(),
  dedupeKey: z.string().nullable(),
  agentId: z.string(),
  agentTitle: z.string().nullable(),
  workspaceId: z.string().nullable(),
  cwd: z.string().nullable(),
  resolution: resolutionSchema.nullable(),
  /** Set when a button press couldn't be delivered; the item is reopened. */
  deliveryError: z.string().nullable().default(null),
  /** Bumped on every change. A button press must name the revision it showed. */
  revision: z.number().int().default(0),
})
export type InboxItem = z.infer<typeof itemSchema>

export const watchInbox = defineSubscription({
  name: "inbox.watch",
  input: z.object({}),
  event: z.object({ items: z.array(itemSchema) }),
})

const ok = z.object({ item: itemSchema })

export const runAction = defineRpc({
  name: "inbox.run-action",
  input: z.object({
    id: z.string(),
    actionId: z.string(),
    /** The item revision the card displayed when the button was pressed. */
    revision: z.number().int(),
  }),
  output: ok,
})

/** Marks an item done after the person chose to reply in the chat. */
export const markEdited = defineRpc({
  name: "inbox.mark-edited",
  input: z.object({ id: z.string() }),
  output: ok,
})

export const dismissItem = defineRpc({
  name: "inbox.dismiss",
  input: z.object({ id: z.string() }),
  output: ok,
})

export const reopenItem = defineRpc({
  name: "inbox.reopen",
  input: z.object({ id: z.string() }),
  output: ok,
})

export const deleteItem = defineRpc({
  name: "inbox.delete",
  input: z.object({ id: z.string() }),
  output: z.object({ ok: z.literal(true) }),
})
