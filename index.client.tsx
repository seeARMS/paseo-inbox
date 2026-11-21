import type {
  PluginClientContext,
  PluginSidebarItemProps,
} from "@getpaseo/plugin/client"
import { SidebarRow } from "@getpaseo/plugin/client/ui"
import { Text, View } from "react-native"
import { InboxScreen, useInboxItems } from "./client/inbox-screen"
import { useStyles } from "./client/styles"

function InboxItem({
  currentScreen,
  openScreen,
  theme,
  layout,
}: PluginSidebarItemProps) {
  const styles = useStyles(theme, layout.compact)
  const { items } = useInboxItems()
  const count = (items ?? []).filter((item) => item.status === "open").length
  return (
    <SidebarRow
      icon="Inbox"
      active={currentScreen?.screenId === "inbox"}
      onPress={() => openScreen({ screenId: "inbox" })}
      trailing={
        count > 0 ? (
          <View
            style={styles.countBadge}
            accessibilityLabel={`${count} open inbox items`}
          >
            <Text style={styles.countBadgeText}>
              {count > 99 ? "99+" : count}
            </Text>
          </View>
        ) : null
      }
    />
  )
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "inbox", title: "Inbox", Component: InboxScreen })
  client.addSidebarHeaderItem({
    id: "inbox",
    title: "Inbox",
    Component: InboxItem,
  })
  client.addCommandCenterItem({
    id: "open-inbox",
    title: "Open inbox",
    icon: "Inbox",
    context: "global",
    onSelect({ openScreen }) {
      openScreen({ screenId: "inbox" })
    },
  })
  return () => {}
}
