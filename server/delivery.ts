import type { PluginHandlerContext } from "@getpaseo/plugin/server"
import type { InboxItem } from "../shared/inbox"
import { list, update } from "./store"

type PaseoApi = PluginHandlerContext["paseo"]
type AgentRef = ReturnType<PaseoApi["agents"]["ref"]>

/**
 * Delivers button presses without interrupting the agent.
 *
 * A plugin message counts as a person's, and a person's message interrupts a
 * running turn by default. Instead every press is sent as a steer: an idle
 * agent starts a turn with it, and a busy agent picks it up as its next
 * message, after the step it is on. Nothing waits for the turn to end.
 *
 * The one case that can't take a message is an agent stopped on a permission
 * prompt: the daemon cancels pending prompts for any message from a person, so
 * a press sent then would deny the very action the person approved. A press
 * for an agent in that state is held ("waiting") until the prompt is answered.
 *
 * Presses for the same agent still go out one at a time, in the order pressed.
 * Waiting presses are rebuilt from items.json the first time the plugin gets a
 * Paseo handle, so a reload or daemon restart doesn't drop them.
 */

const chains = new Map<string, Promise<void>>()
const inFlight = new Set<string>()
let resumed = false

const POLL_MS = 2000
const ATTEMPTS = 3
const RETRY_MS = 1000
/**
 * Errors the daemon raises before the provider takes the message: the turn
 * a steer aimed at ended or changed, or the agent was mid-switch.
 */
const NOT_DELIVERED = /turn changed|before steering|is running/i

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function setDelivery(itemId: string, delivery: "queued" | "waiting") {
  return update(itemId, (current) =>
    current.resolution?.delivery === delivery || !current.resolution
      ? current
      : { ...current, resolution: { ...current.resolution, delivery } }
  )
}

/** Returns once the agent has no open permission prompt. */
async function waitForPermissions(agent: AgentRef, itemId: string) {
  let waiting = false
  for (;;) {
    await agent.refresh()
    if (!agent.pendingPermissions?.length) {
      if (waiting) await setDelivery(itemId, "queued")
      return
    }
    if (!waiting) {
      waiting = true
      await setDelivery(itemId, "waiting")
    }
    await sleep(POLL_MS)
  }
}

async function deliver(paseo: PaseoApi, itemId: string) {
  const item = (await list()).find((other) => other.id === itemId)
  const text = item?.resolution?.text
  const pending =
    item?.resolution?.delivery === "queued" ||
    item?.resolution?.delivery === "waiting"
  if (!item || !pending || !text) return
  const agent = paseo.agents.ref(item.agentId)
  try {
    for (let attempt = 1; ; attempt++) {
      await waitForPermissions(agent, itemId)
      // The daemon keeps a receipt per message id, so a resend under the same
      // id can never deliver twice. Only a refusal that means "not delivered"
      // is retried, and that retry needs a new id.
      const messageId = `inbox-${item.id}-${item.revision}-${attempt}`
      try {
        await agent.send(text, { activeTurnBehavior: "steer", messageId })
        break
      } catch (error) {
        if (attempt >= ATTEMPTS || !NOT_DELIVERED.test(errorText(error))) {
          throw error
        }
        console.error(`[inbox] retrying ${itemId}:`, errorText(error))
        await sleep(RETRY_MS)
      }
    }
    await update(itemId, (current) => ({
      ...current,
      resolution: current.resolution && {
        ...current.resolution,
        delivery: "sent",
        deliveredAt: new Date().toISOString(),
      },
    }))
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

/** Re-sends presses that were still pending when the plugin last stopped. */
export async function resumeQueued(paseo: PaseoApi) {
  if (resumed) return
  resumed = true
  const pending = (await list())
    .filter(
      (item) =>
        item.resolution?.delivery === "queued" ||
        item.resolution?.delivery === "waiting"
    )
    .sort((a, b) =>
      (a.resolution?.at ?? "").localeCompare(b.resolution?.at ?? "")
    )
  for (const item of pending) enqueue(paseo, item)
}
