import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Brand } from "@/components/Brand";
import { colors, shadow } from "@/lib/theme";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "quiet" | "dark";
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
}) {
  const buttonStyle = variant === "primary" ? styles.primary
    : variant === "dark" ? styles.dark
    : variant === "outline" ? styles.outline
    : styles.quiet;
  const textStyle = variant === "primary" || variant === "dark" ? styles.lightText : styles.darkText;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, buttonStyle, (disabled || loading) && styles.disabled, pressed && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={variant === "primary" ? colors.white : colors.ink} size="small" />
        : <Text style={[styles.buttonText, textStyle]}>{icon ? `${icon}  ` : ""}{label}</Text>}
    </Pressable>
  );
}

export function Surface({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function Notice({ children, tone = "error" }: PropsWithChildren<{ tone?: "error" | "success" | "info" }>) {
  return <View style={[styles.notice, tone === "success" ? styles.success : tone === "info" ? styles.info : styles.error]}>
    <Text style={[styles.noticeText, tone === "success" ? styles.successText : tone === "info" ? styles.infoText : styles.errorText]}>{children}</Text>
  </View>;
}

export function PageTitle({ eyebrow, title, detail }: { eyebrow?: string; title: string; detail?: string }) {
  return <View style={styles.pageTitle}>
    {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
    <Text style={styles.title}>{title}</Text>
    {detail && <Text style={styles.detail}>{detail}</Text>}
  </View>;
}

export function Header({ right }: { right?: ReactNode }) {
  return <View style={styles.header}>
    <Brand />
    <View style={styles.headerRight}>{right}</View>
  </View>;
}

export function WordmarkBadge({ label }: { label: string }) {
  return <View style={styles.badge}><Text style={styles.badgeText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  header: { width: "100%", maxWidth: 1120, alignSelf: "center", minHeight: 76, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  button: { minHeight: 46, paddingHorizontal: 20, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  primary: { backgroundColor: colors.orange },
  dark: { backgroundColor: colors.ink },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  quiet: { backgroundColor: "transparent" },
  buttonText: { fontSize: 14, fontWeight: "800", letterSpacing: 0.1 },
  lightText: { color: colors.white },
  darkText: { color: colors.ink },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  surface: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 22, padding: 22, ...shadow },
  notice: { padding: 14, borderRadius: 13, borderWidth: 1 },
  noticeText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  error: { backgroundColor: "#FFF1EE", borderColor: "#F4C4B9" },
  errorText: { color: colors.red },
  success: { backgroundColor: "#ECF7F0", borderColor: "#BFE3CC" },
  successText: { color: colors.green },
  info: { backgroundColor: "#FFF7E7", borderColor: "#F1D89E" },
  infoText: { color: "#76551D" },
  pageTitle: { gap: 9, marginBottom: 24 },
  eyebrow: { color: colors.orangeDark, fontSize: 12, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase" },
  title: { color: colors.ink, fontSize: 36, lineHeight: 42, fontWeight: "900", letterSpacing: -1.3 },
  detail: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  badge: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 99, backgroundColor: "#FFF0C9", alignSelf: "flex-start" },
  badgeText: { fontSize: 11, color: "#70541C", letterSpacing: 0.8, fontWeight: "900", textTransform: "uppercase" },
});
