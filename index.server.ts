import type { PluginServerContext } from "@getpaseo/plugin/server"
import { enqueue, resumeQueued } from "./server/delivery"
import { type Notifications, setNotifications } from "./server/notify"
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
  setNotifications(
    (server as { notifications?: Notifications }).notifications
  )
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

  // Not async: a subscription closes when its handler's promise settles, so
  // this must return void and stay open until the subscriber aborts.
  server.handle(watchInbox, (_input, { push, signal, paseo }) => {
    void resumeQueued(paseo)
    const stop = watch((items) => void push({ items }))
    signal.addEventListener("abort", () => stop())
    void list().then((items) => push({ items }))
  })

  server.handle(runAction, async ({ id, actionId, revision }, { paseo }) => {
    // Check and resolve in one store write, against the revision the card
    // showed, so a press can't act on an item that changed underneath it
    // (for example a dedupe refresh that swapped the agent or the messages).
    const resolved = await update(id, (item) => {
      if (item.status !== "open") throw new Error("This item is already closed")
      if (item.revision !== revision) {
        throw new Error(
          "This item changed since you opened it. Check the updated card and choose again."
        )
      }
      const action = item.actions.find((other) => other.id === actionId)
      if (!action) throw new Error("That action no longer exists")
      return {
        ...item,
        status: "done",
        deliveryError: null,
        resolution: {
          kind: "action",
          actionId,
          label: action.label,
          text: `[Inbox: ${item.title}]\n\n${action.message}`,
          // Sent by the per-agent delivery chain, as a steer that never interrupts.
          delivery: "queued",
          deliveredAt: null,
          at: new Date().toISOString(),
        },
      }
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

  return () => {
    removeHook()
    setNotifications(undefined)
  }
}
