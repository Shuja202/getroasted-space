import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" asChild>
      <Pressable accessibilityRole="link" style={styles.brand}>
        <View style={styles.mark}><Text style={styles.markText}>G</Text></View>
        {!compact && (
          <Text style={styles.name}>
            getroasted<Text style={styles.dot}>.</Text>
          </Text>
        )}
      </Pressable>
    </Link>
  );
}

export const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: {
    width: 38, height: 38, borderRadius: 13, backgroundColor: colors.orange,
    alignItems: "center", justifyContent: "center", transform: [{ rotate: "-7deg" }],
  },
  markText: { color: colors.white, fontSize: 22, fontWeight: "900" },
  name: { color: colors.ink, fontSize: 20, fontWeight: "900", letterSpacing: -0.8 },
  dot: { color: colors.orange },
});
