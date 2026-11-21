import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { z } from "zod"
import {
  type InboxAction,
  type InboxItem,
  type InboxResolution,
  itemSchema,
} from "../shared/inbox"

const FILE = join(
  process.env.PASEO_HOME ?? join(homedir(), ".paseo"),
  "inbox",
  "items.json"
)

type Listener = (items: InboxItem[]) => void

let items: InboxItem[] | null = null
let queue: Promise<unknown> = Promise.resolve()
const listeners = new Set<Listener>()

async function load(): Promise<InboxItem[]> {
  if (items) return items
  try {
    const raw = JSON.parse(await readFile(FILE, "utf8"))
    items = z.object({ items: z.array(itemSchema) }).parse(raw).items
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[inbox] could not read", FILE, error)
    }
    items = []
  }
  return items
}

async function save(next: InboxItem[]) {
  items = next
  await mkdir(dirname(FILE), { recursive: true })
  const tmp = `${FILE}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify({ items: next }, null, 2))
  await rename(tmp, FILE)
  for (const listener of listeners) listener(next)
}

/** Runs one read-modify-write at a time so concurrent tool calls never lose items. */
function mutate<T>(
  fn: (current: InboxItem[]) => { next: InboxItem[]; result: T }
): Promise<T> {
  const run = queue.then(async () => {
    const { next, result } = fn(await load())
    await save(next)
    return result
  })
  queue = run.catch(() => undefined)
  return run
}

export async function list() {
  await queue
  return load()
}

export function watch(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export interface NewItem {
  title: string
  body: string
  source: string | null
  links: { label: string; url: string }[]
  actions: Omit<InboxAction, "id">[]
  draft: string | null
  dedupeKey: string | null
  agentId: string
  agentTitle: string | null
  workspaceId: string | null
  cwd: string | null
}

/** Adds an item, or refreshes the open item with the same dedupe key. */
export function add(input: NewItem) {
  return mutate((current) => {
    const now = new Date().toISOString()
    const actions = input.actions.map((action, index) => ({
      ...action,
      id: `a${index + 1}`,
    }))
    const existing = input.dedupeKey
      ? current.find(
          (item) => item.status === "open" && item.dedupeKey === input.dedupeKey
        )
      : undefined
    if (existing) {
      const item: InboxItem = {
        ...existing,
        ...input,
        actions,
        updatedAt: now,
        deliveryError: null,
        revision: existing.revision + 1,
      }
      return {
        next: current.map((other) => (other.id === existing.id ? item : other)),
        result: { item, updated: true },
      }
    }
    const item: InboxItem = {
      ...input,
      actions,
      id: randomUUID().slice(0, 8),
      createdAt: now,
      updatedAt: now,
      status: "open",
      resolution: null,
      deliveryError: null,
      revision: 0,
    }
    return { next: [item, ...current], result: { item, updated: false } }
  })
}

export function update(
  id: string,
  change: (item: InboxItem) => InboxItem
): Promise<InboxItem> {
  return mutate((current) => {
    const found = current.find((item) => item.id === id)
    if (!found) throw new Error(`No inbox item ${id}`)
    const item = {
      ...change(found),
      updatedAt: new Date().toISOString(),
      revision: found.revision + 1,
    }
    return {
      next: current.map((other) => (other.id === id ? item : other)),
      result: item,
    }
  })
}

export function resolve(
  id: string,
  status: "done" | "dismissed",
  resolution: Omit<InboxResolution, "at" | "delivery" | "deliveredAt"> &
    Partial<Pick<InboxResolution, "delivery">>
) {
  return update(id, (item) => ({
    ...item,
    status,
    deliveryError: null,
    resolution: {
      delivery: null,
      deliveredAt: null,
      ...resolution,
      at: new Date().toISOString(),
    },
  }))
}

/** Finds an item by id, or the newest item with that dedupe key (open first). */
export async function findItem(ref: { id?: string; dedupeKey?: string }) {
  const all = await list()
  if (ref.id) return all.find((item) => item.id === ref.id)
  if (!ref.dedupeKey) return undefined
  const matches = all.filter((item) => item.dedupeKey === ref.dedupeKey)
  return matches.find((item) => item.status === "open") ?? matches[0]
}

export function remove(id: string) {
  return mutate((current) => ({
    next: current.filter((item) => item.id !== id),
    result: undefined,
  }))
}
