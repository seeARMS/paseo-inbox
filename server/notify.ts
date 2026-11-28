import type { InboxItem } from "../shared/inbox"

// Typed locally: `server.notifications` only exists on Paseo 0.18+.
export interface Notifications {
  send(notification: {
    title: string
    body: string
    key: string
    open: { type: "agent"; agentId: string }
  }): unknown
}

let notifications: Notifications | undefined

export function setNotifications(next: Notifications | undefined) {
  notifications = next
}

export async function notifyNewItem(
  sender: Notifications | undefined,
  item: InboxItem,
  updated: boolean
) {
  if (updated || !sender) return
  const body =
    item.agentTitle?.trim() ||
    item.body.split("\n").find((line) => line.trim())?.trim() ||
    item.title
  try {
    await sender.send({
      title: item.title,
      body,
      key: `inbox:${item.id}`,
      open: { type: "agent", agentId: item.agentId },
    })
  } catch (error) {
    console.warn("[inbox] push notification failed", error)
  }
}

export function notifyNew(item: InboxItem, updated: boolean) {
  return notifyNewItem(notifications, item, updated)
}
