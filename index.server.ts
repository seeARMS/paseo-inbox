import type { PluginServerContext } from "@getpaseo/plugin/server"
import { enqueue, resumeQueued } from "./server/delivery"
import { list, remove, resolve, update, watch } from "./server/store"
import {
  INBOX_INSTRUCTIONS,
  inboxAdd,
  inboxList,
  inboxResolve,
} from "./server/tools"
import {
  deleteItem,
  dismissItem,
  markEdited,
  reopenItem,
  runAction,
  watchInbox,
} from "./shared/inbox"

export default function contribute(server: PluginServerContext) {
  const removeHook = server.addHook(
    "agent.open.before",
    async ({ request }, { paseo }) => {
      void resumeQueued(paseo)
      if (request.background) return request
      return {
        ...request,
        appendSystemPrompt: [
          ...(request.appendSystemPrompt ?? []),
          INBOX_INSTRUCTIONS,
        ],
        tools: [...request.tools, inboxAdd, inboxList, inboxResolve],
      }
    }
  )

  server.handle(watchInbox, async (_input, { push, signal, paseo }) => {
    void resumeQueued(paseo)
    await push({ items: await list() })
    const stop = watch((items) => void push({ items }))
    signal.addEventListener("abort", () => stop())
  })

  server.handle(runAction, async ({ id, actionId }, { paseo }) => {
    const item = (await list()).find((other) => other.id === id)
    if (!item) throw new Error(`No inbox item ${id}`)
    if (item.status !== "open") throw new Error("This item is already closed")
    const action = item.actions.find((other) => other.id === actionId)
    if (!action) throw new Error("That action no longer exists")
    const text = `[Inbox: ${item.title}]\n\n${action.message}`
    // Queued, not sent inline: a busy agent gets it when its turn ends.
    const resolved = await resolve(id, "done", {
      kind: "action",
      actionId,
      label: action.label,
      text,
      delivery: "queued",
    })
    enqueue(paseo, resolved)
    return { item: resolved }
  })

  server.handle(markEdited, async ({ id }) => ({
    item: await resolve(id, "done", {
      kind: "edit",
      actionId: null,
      label: "Replied in chat",
      text: null,
    }),
  }))

  server.handle(dismissItem, async ({ id }) => ({
    item: await resolve(id, "dismissed", {
      kind: "dismissed",
      actionId: null,
      label: null,
      text: null,
    }),
  }))

  server.handle(reopenItem, async ({ id }) => ({
    item: await update(id, (item) => ({
      ...item,
      status: "open",
      resolution: null,
      deliveryError: null,
    })),
  }))

  server.handle(deleteItem, async ({ id }) => {
    await remove(id)
    return { ok: true as const }
  })

  return () => removeHook()
}
