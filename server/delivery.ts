import type { PluginHandlerContext } from "@getpaseo/plugin/server"
import type { InboxItem } from "../shared/inbox"
import { list, update } from "./store"

type PaseoApi = PluginHandlerContext["paseo"]

/**
 * Sends button presses to agents without interrupting them. Paseo treats a
 * plugin message as a human one, and a human message interrupts a running
 * turn, so each agent gets a queue: wait for its current turn, send, then wait
 * for that turn too before the next press for the same agent goes out.
 *
 * The queue is rebuilt from items.json (resolution.delivery === "queued") the
 * first time the plugin gets a Paseo handle, so a reload or daemon restart
 * doesn't drop presses.
 */

const chains = new Map<string, Promise<void>>()
const inFlight = new Set<string>()
let resumed = false

const NO_TIMEOUT = 0

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function deliver(paseo: PaseoApi, itemId: string) {
  const item = (await list()).find((other) => other.id === itemId)
  const text = item?.resolution?.text
  if (!item || item.resolution?.delivery !== "queued" || !text) return
  const agent = paseo.agents.ref(item.agentId)
  try {
    await agent.refresh()
    if (agent.status === "running" || agent.status === "initializing") {
      await agent.waitForFinish(NO_TIMEOUT)
    }
    await agent.send(text)
    await update(itemId, (current) => ({
      ...current,
      resolution: current.resolution && {
        ...current.resolution,
        delivery: "sent",
        deliveredAt: new Date().toISOString(),
      },
    }))
    // Hold the queue until this turn ends, so the next press doesn't cut it off.
    await agent.waitForFinish(NO_TIMEOUT).catch(() => undefined)
  } catch (error) {
    console.error(`[inbox] delivery of ${itemId} failed`, error)
    await update(itemId, (current) => ({
      ...current,
      status: "open",
      resolution: null,
      deliveryError: `Couldn't reach the agent: ${errorText(error)}`,
    }))
  }
}

export function enqueue(paseo: PaseoApi, item: InboxItem) {
  if (inFlight.has(item.id)) return
  inFlight.add(item.id)
  const previous = chains.get(item.agentId) ?? Promise.resolve()
  const next = previous
    .then(() => deliver(paseo, item.id))
    .finally(() => inFlight.delete(item.id))
  chains.set(item.agentId, next)
  void next.finally(() => {
    if (chains.get(item.agentId) === next) chains.delete(item.agentId)
  })
}

/** Re-queues presses that were waiting when the plugin last stopped. */
export async function resumeQueued(paseo: PaseoApi) {
  if (resumed) return
  resumed = true
  const queued = (await list())
    .filter((item) => item.resolution?.delivery === "queued")
    .sort((a, b) =>
      (a.resolution?.at ?? "").localeCompare(b.resolution?.at ?? "")
    )
  for (const item of queued) enqueue(paseo, item)
}
