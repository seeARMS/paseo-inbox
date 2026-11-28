import assert from "node:assert/strict"
import { test } from "node:test"
import type { InboxItem } from "../shared/inbox"
import { notifyNewItem } from "../server/notify.ts"

const item = {
  id: "abc12345",
  title: "Send follow-up to Jane?",
  body: "Draft below\nmore",
  agentId: "agent-1",
  agentTitle: "Outreach",
} as InboxItem

test("a new item sends one notification", async () => {
  const sent: unknown[] = []
  await notifyNewItem({ send: async (n) => void sent.push(n) }, item, false)
  assert.deepEqual(sent, [
    {
      title: "Send follow-up to Jane?",
      body: "Outreach",
      key: "inbox:abc12345",
      open: { type: "agent", agentId: "agent-1" },
    },
  ])
})

test("body falls back to the first body line, then the title", async () => {
  const sent: { body: string }[] = []
  const send = async (n: { body: string }) => void sent.push(n)
  await notifyNewItem({ send }, { ...item, agentTitle: null }, false)
  await notifyNewItem({ send }, { ...item, agentTitle: null, body: "" }, false)
  assert.deepEqual(
    sent.map((n) => n.body),
    ["Draft below", "Send follow-up to Jane?"]
  )
})

test("a dedupe update sends nothing", async () => {
  let calls = 0
  await notifyNewItem({ send: async () => void calls++ }, item, true)
  assert.equal(calls, 0)
})

test("no notifications on the server (Paseo 0.17) is a no-op", async () => {
  await notifyNewItem(undefined, item, false)
})

test("a rejected or throwing send never throws", async () => {
  await notifyNewItem(
    { send: async () => Promise.reject(new Error("rate_limited")) },
    item,
    false
  )
  await notifyNewItem(
    {
      send: () => {
        throw new Error("boom")
      },
    },
    item,
    false
  )
})
