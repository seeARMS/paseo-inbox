import {
  type PluginScreenProps,
  useComposers,
  useRpc,
  useSubscription,
} from "@getpaseo/plugin/client"
import {
  Icon,
  Loading,
  Markdown,
  ScrollView,
  useToast,
} from "@getpaseo/plugin/client/ui"
import { useState } from "react"
import {
  Pressable,
  type PressableStateCallbackType,
  Text,
  View,
} from "react-native"
import {
  deleteItem,
  dismissItem,
  type InboxItem,
  markEdited,
  reopenItem,
  runAction,
  watchInbox,
} from "../shared/inbox"
import { Button, Segmented, type Styles, type Theme, useStyles } from "./styles"

const NO_INPUT = {}

export function useInboxItems() {
  const [items, setItems] = useState<InboxItem[] | null>(null)
  const state = useSubscription(watchInbox, NO_INPUT, (event) =>
    setItems(event.items)
  )
  return { items, state }
}

function relative(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function bodyMarkdown(item: InboxItem) {
  const links = item.links.map((link) => `- [${link.label}](${link.url})`)
  return [item.body.trim(), links.join("\n")].filter(Boolean).join("\n\n")
}

function resolutionLabel(item: InboxItem) {
  const r = item.resolution
  if (!r) return item.status
  const when = relative(r.at)
  if (r.kind === "action" && r.delivery === "queued")
    return `You chose “${r.label}” · Sends when the agent finishes its current task`
  if (r.kind === "action") return `You chose “${r.label}” · ${when}`
  if (r.kind === "edit") return `You replied in the chat · ${when}`
  if (r.kind === "agent")
    return `The agent closed it${r.text ? `: ${r.text}` : ""} · ${when}`
  return `Dismissed · ${when}`
}

type ScreenContext = Pick<PluginScreenProps, "host" | "navigation"> & {
  theme: Theme
  styles: Styles
}

function ItemCard({ item, ctx }: { item: InboxItem; ctx: ScreenContext }) {
  const { theme, styles, host, navigation } = ctx
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const composers = useComposers({ agentId: item.agentId })
  const act = useRpc(runAction)
  const edited = useRpc(markEdited)
  const dismiss = useRpc(dismissItem)
  const reopen = useRpc(reopenItem)
  const remove = useRpc(deleteItem)
  const open = item.status === "open"

  async function guard(fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function openChat(prefill: boolean) {
    const composer = composers[0]
    if (prefill && composer) {
      if (item.draft) composer.setPrompt(item.draft)
      await composer.focus()
      return
    }
    if (navigation) {
      navigation.openAgent({ agentId: item.agentId, serverId: host.id })
      return
    }
    if (composer) return composer.focus()
    throw new Error("This Paseo client can't open agents")
  }

  const meta = [item.source, item.agentTitle ?? item.agentId.slice(0, 8)]
    .filter(Boolean)
    .concat(relative(item.createdAt))
  const body = bodyMarkdown(item)

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open the conversation for ${item.title}`}
        onPress={() => void guard(() => openChat(false))}
        style={(state: PressableStateCallbackType & { hovered?: boolean }) => [
          styles.cardHeader,
          state.hovered && styles.cardHeaderHover,
        ]}
      >
        {(state: PressableStateCallbackType & { hovered?: boolean }) => (
          <>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.updatedAt !== item.createdAt && open && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Updated</Text>
                </View>
              )}
              <Icon
                name="ArrowUpRight"
                size={15}
                color={
                  state.hovered
                    ? theme.colors.foreground
                    : theme.colors.foregroundMuted
                }
              />
            </View>
            <View style={styles.meta}>
              {meta.map((part, index) => (
                <View key={`${index}-${part}`} style={styles.meta}>
                  {index > 0 && <Text style={styles.metaDot}>·</Text>}
                  <Text style={styles.metaText}>{part}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Pressable>
      {open && item.deliveryError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{item.deliveryError}</Text>
        </View>
      )}
      {body.length > 0 && (
        <View style={styles.bodyText}>
          <Markdown>{body}</Markdown>
        </View>
      )}
      {!open && (
        <View style={styles.resolution}>
          <Icon
            name={
              item.resolution?.delivery === "queued"
                ? "Clock"
                : item.status === "done"
                  ? "CircleCheck"
                  : "CircleSlash"
            }
            size={14}
            color={theme.colors.foregroundMuted}
          />
          <Text style={styles.resolutionText}>{resolutionLabel(item)}</Text>
        </View>
      )}
      <View style={styles.actions}>
        {open &&
          item.actions.map((action, index) => (
            <Button
              key={action.id}
              text={action.label}
              variant={index === 0 ? "primary" : "outline"}
              disabled={busy}
              styles={styles}
              theme={theme}
              onPress={() =>
                void guard(async () => {
                  await act({ id: item.id, actionId: action.id })
                  toast.show(`Sent “${action.label}” to the agent`, {
                    variant: "success",
                  })
                })
              }
            />
          ))}
        {open && (
          <Button
            text="Edit"
            icon="Pencil"
            disabled={busy}
            styles={styles}
            theme={theme}
            onPress={() =>
              void guard(async () => {
                await openChat(true)
                await edited({ id: item.id })
              })
            }
          />
        )}
        <View style={styles.spacer} />
        <Button
          text="Open chat"
          icon="MessageSquare"
          variant="ghost"
          disabled={busy}
          styles={styles}
          theme={theme}
          onPress={() => void guard(() => openChat(false))}
        />
        {open ? (
          <Button
            text="Dismiss"
            variant="ghost"
            disabled={busy}
            styles={styles}
            theme={theme}
            onPress={() => void guard(() => dismiss({ id: item.id }))}
          />
        ) : (
          <>
            <Button
              text="Reopen"
              icon="RotateCcw"
              variant="ghost"
              disabled={busy}
              styles={styles}
              theme={theme}
              onPress={() => void guard(() => reopen({ id: item.id }))}
            />
            <Button
              text="Delete"
              icon="Trash2"
              variant="ghost"
              disabled={busy}
              styles={styles}
              theme={theme}
              onPress={() => void guard(() => remove({ id: item.id }))}
            />
          </>
        )}
      </View>
    </View>
  )
}

type Tab = "open" | "history"

export function InboxScreen({
  theme,
  layout,
  host,
  navigation,
}: PluginScreenProps) {
  const styles = useStyles(theme, layout.compact)
  const { items, state } = useInboxItems()
  const [tab, setTab] = useState<Tab>("open")
  const ctx: ScreenContext = { theme, styles, host, navigation }

  const openItems = (items ?? []).filter((item) => item.status === "open")
  const history = (items ?? [])
    .filter((item) => item.status !== "open")
    .sort((a, b) =>
      (b.resolution?.at ?? b.updatedAt).localeCompare(
        a.resolution?.at ?? a.updatedAt
      )
    )
  const shown = tab === "open" ? openItems : history

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <Text style={styles.title}>Inbox</Text>
          <Segmented
            styles={styles}
            value={tab}
            onChange={setTab}
            options={[
              {
                key: "open",
                label: `Open${openItems.length ? ` (${openItems.length})` : ""}`,
              },
              { key: "history", label: "History" },
            ]}
          />
        </View>
      </View>
      {items === null ? (
        state.status === "error" ? (
          <View style={styles.state}>
            <Text style={styles.stateTitle}>Couldn't load the inbox</Text>
            <Text style={styles.stateText}>{state.error.message}</Text>
          </View>
        ) : (
          <Loading />
        )
      ) : (
        <ScrollView style={styles.scroll}>
          <View style={styles.body}>
            {shown.length === 0 ? (
              <View style={styles.state}>
                <Icon
                  name={tab === "open" ? "Inbox" : "History"}
                  size={22}
                  color={theme.colors.foregroundMuted}
                />
                <Text style={styles.stateTitle}>
                  {tab === "open" ? "Nothing needs you" : "No history yet"}
                </Text>
                <Text style={styles.stateText}>
                  {tab === "open"
                    ? "When an agent needs a decision or manual step from you, it shows up here."
                    : "Items you act on or dismiss are kept here."}
                </Text>
              </View>
            ) : (
              shown.map((item) => (
                <ItemCard key={item.id} item={item} ctx={ctx} />
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  )
}
