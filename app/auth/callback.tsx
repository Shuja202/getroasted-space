import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Brand } from "@/components/Brand";
import { Notice } from "@/components/Primitives";
import { colors } from "@/lib/theme";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function complete() {
      if (!isSupabaseConfigured) {
        setError("Supabase isn't configured. See README for setup steps.");
        return;
      }
      const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
      const code = params.code ?? url?.searchParams.get("code");
      const providerError = params.error_description ?? url?.searchParams.get("error_description");
      if (providerError) {
        setError(providerError);
        return;
      }
      try {
        if (code) {
          const { error: exchangeError } = await requireSupabase().auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        const { data, error: sessionError } = await requireSupabase().auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error("No sign-in session was returned. Try signing in again.");
        if (active) router.replace("/");
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "We couldn't finish sign-in.");
      }
    }
    void complete();
    return () => { active = false; };
  }, [params.code, params.error_description]);

  return <View style={styles.page}>
    <Brand />
    <View style={styles.center}>
      {error ? <Notice>{error}</Notice> : <><ActivityIndicator color={colors.orange} /><Text style={styles.text}>Finishing your sign-in…</Text></>}
      <Text onPress={() => router.replace("/auth")} style={styles.link}>Return to sign in</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 24, alignItems: "center", gap: 45, backgroundColor: colors.paper },
  center: { width: "100%", maxWidth: 400, alignItems: "center", gap: 16, marginTop: 70 },
  text: { color: colors.ink, fontWeight: "700" },
  link: { color: colors.orangeDark, fontWeight: "800", marginTop: 10 },
});
