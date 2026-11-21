import type { PluginScreenProps } from "@getpaseo/plugin/client"
import { Icon } from "@getpaseo/plugin/client/ui"
import { useMemo } from "react"
import {
  Pressable,
  type PressableStateCallbackType,
  StyleSheet,
  Text,
  View,
} from "react-native"

export type Theme = PluginScreenProps["theme"]
type PressState = PressableStateCallbackType & { hovered?: boolean }

export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (!hex) return color
  const raw = hex[1]
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : raw.slice(0, 6)
  const aa = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
  return `#${full}${aa}`
}

export function useStyles(theme: Theme, compact: boolean) {
  const c = theme.colors
  return useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, minHeight: 0, backgroundColor: c.surface0 },
        header: {
          paddingHorizontal: compact ? 16 : 24,
          paddingTop: compact ? 12 : 18,
          paddingBottom: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: c.border,
        },
        headerInner: {
          width: "100%",
          maxWidth: 820,
          alignSelf: "center",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        },
        title: {
          color: c.foreground,
          fontSize: 18,
          fontWeight: "600",
          letterSpacing: -0.2,
        },
        scroll: { flex: 1, minHeight: 0 },
        body: {
          width: "100%",
          maxWidth: 820,
          alignSelf: "center",
          paddingHorizontal: compact ? 16 : 24,
          paddingVertical: compact ? 14 : 20,
          gap: 12,
        },
        card: {
          padding: 14,
          gap: 10,
          borderRadius: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.border,
          backgroundColor: c.surface1,
        },
        cardHeader: {
          gap: 6,
          marginHorizontal: -8,
          marginTop: -6,
          paddingHorizontal: 8,
          paddingVertical: 6,
          borderRadius: 7,
        },
        cardHeaderHover: { backgroundColor: c.surface2 },
        cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
        cardTitle: {
          flex: 1,
          minWidth: 0,
          color: c.foreground,
          fontSize: 14,
          fontWeight: "600",
          lineHeight: 20,
        },
        meta: {
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
        },
        metaText: { color: c.foregroundMuted, fontSize: 12, lineHeight: 16 },
        metaDot: { color: c.foregroundMuted, fontSize: 12, opacity: 0.6 },
        bodyText: { minWidth: 0 },
        actions: {
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          paddingTop: 2,
        },
        spacer: { flex: 1 },
        resolution: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 7,
          borderRadius: 7,
          backgroundColor: c.surface2,
        },
        resolutionText: {
          flex: 1,
          color: c.foregroundMuted,
          fontSize: 12.5,
          lineHeight: 17,
        },
        errorBox: {
          padding: 10,
          borderRadius: 7,
          backgroundColor: withAlpha(c.statusDanger, 0.1),
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: withAlpha(c.statusDanger, 0.3),
        },
        errorText: { color: c.statusDanger, fontSize: 12.5, lineHeight: 18 },
        segmented: {
          flexDirection: "row",
          backgroundColor: c.surface1,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.border,
          borderRadius: 7,
          padding: 2,
          gap: 2,
        },
        segment: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 5 },
        segmentSelected: { backgroundColor: c.surface2 },
        segmentText: {
          color: c.foregroundMuted,
          fontSize: 12,
          fontWeight: "500",
        },
        segmentTextSelected: { color: c.foreground },
        button: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingHorizontal: 11,
          height: 30,
          borderRadius: 7,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: "transparent",
        },
        buttonPrimary: { backgroundColor: c.accent, borderColor: c.accent },
        buttonGhost: { borderColor: "transparent" },
        buttonHover: { backgroundColor: c.surface2 },
        buttonPressed: { opacity: 0.82 },
        disabled: { opacity: 0.45 },
        buttonText: { color: c.foreground, fontSize: 12.5, fontWeight: "500" },
        buttonTextPrimary: { color: c.accentForeground },
        buttonTextGhost: { color: c.foregroundMuted },
        badge: {
          paddingHorizontal: 7,
          paddingVertical: 1.5,
          borderRadius: 999,
          backgroundColor: c.surface2,
        },
        badgeText: {
          color: c.foregroundMuted,
          fontSize: 11,
          fontWeight: "500",
        },
        state: {
          paddingVertical: 64,
          paddingHorizontal: 24,
          gap: 8,
          alignItems: "center",
        },
        stateTitle: { color: c.foreground, fontSize: 14, fontWeight: "600" },
        stateText: {
          color: c.foregroundMuted,
          fontSize: 13,
          lineHeight: 19,
          textAlign: "center",
          maxWidth: 420,
        },
        countBadge: {
          minWidth: 18,
          height: 18,
          paddingHorizontal: 5,
          borderRadius: 9,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.accent,
        },
        countBadgeText: {
          color: c.accentForeground,
          fontSize: 11,
          fontWeight: "600",
        },
      }),
    [c, compact]
  )
}

export type Styles = ReturnType<typeof useStyles>

export function Button({
  text,
  icon,
  onPress,
  styles,
  theme,
  variant = "outline",
  disabled,
}: {
  text: string
  icon?: string
  onPress: () => void
  styles: Styles
  theme: Theme
  variant?: "primary" | "outline" | "ghost"
  disabled?: boolean
}) {
  const iconColor =
    variant === "primary"
      ? theme.colors.accentForeground
      : variant === "ghost"
        ? theme.colors.foregroundMuted
        : theme.colors.foreground
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={(state: PressState) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "ghost" && styles.buttonGhost,
        state.hovered &&
          !disabled &&
          variant !== "primary" &&
          styles.buttonHover,
        state.pressed && !disabled && styles.buttonPressed,
        disabled && styles.disabled,
      ]}
    >
      {icon && <Icon name={icon} size={14} color={iconColor} />}
      <Text
        style={[
          styles.buttonText,
          variant === "primary" && styles.buttonTextPrimary,
          variant === "ghost" && styles.buttonTextGhost,
        ]}
      >
        {text}
      </Text>
    </Pressable>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  styles,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (next: T) => void
  styles: Styles
}) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const selected = opt.key === value
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.key)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text
              style={[
                styles.segmentText,
                selected && styles.segmentTextSelected,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
