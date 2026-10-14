import { Link, router } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Brand } from "@/components/Brand";
import { Button, Notice, Surface } from "@/components/Primitives";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

function callbackUrl() {
  return Platform.OS === "web"
    ? `${window.location.origin}/auth/callback`
    : Linking.createURL("auth/callback");
}

export default function AuthScreen() {
  const { user } = useAuth();
  const compact = useWindowDimensions().width < 800;
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submitEmail() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const client = requireSupabase();
      if (mode === "signup") {
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: callbackUrl() },
        });
        if (authError) throw authError;
        if (data.session) router.replace("/");
        else setMessage("Check your inbox for a verification link. You need a verified email before publishing.");
      } else {
        const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        router.replace("/");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn't complete sign-in.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWith(provider: "google" | "github" | "apple") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data, error: authError } = await requireSupabase().auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl(), skipBrowserRedirect: Platform.OS !== "web" },
      });
      if (authError) throw authError;
      if (Platform.OS === "web") {
        if (!data.url) throw new Error("The provider did not return a sign-in link.");
        window.location.assign(data.url);
        return;
      }
      if (!data.url) throw new Error("The provider did not return a sign-in link.");
      const result = await WebBrowser.openAuthSessionAsync(data.url, callbackUrl());
      if (result.type === "success" && result.url) {
        const returned = new URL(result.url);
        const code = returned.searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await requireSupabase().auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          const params = new URLSearchParams(returned.hash.replace(/^#/, ""));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (!accessToken || !refreshToken) throw new Error("The provider did not return a valid session.");
          const { error: sessionError } = await requireSupabase().auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        }
        router.replace("/");
      } else if (result.type === "cancel") {
        setMessage("Sign-in was cancelled.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Social sign-in failed. Check the provider setup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.nav}><Brand /><Link href="/" asChild><Pressable><Text style={styles.back}>← Back home</Text></Pressable></Link></View>
      <View style={[styles.layout, compact && styles.layoutCompact]}>
        <View style={[styles.pitch, compact && styles.pitchCompact]}>
          <Text style={styles.eyebrow}>YOUR LINK. THEIR ROASTS.</Text>
          <Text style={styles.title}>A little{"\n"}humility looks{"\n"}good on you.</Text>
          <Text style={styles.description}>Make a post, share one link, and let the internet workshop your ego.</Text>
          <Text style={styles.privacy}>✓  Only post owners need an account{"\n"}✓  Email verification keeps posts accountable{"\n"}✓  Roasts never show an author</Text>
        </View>
        <Surface style={styles.formCard}>
          <Text style={styles.formEyebrow}>{mode === "signup" ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}</Text>
          <Text style={styles.formTitle}>{mode === "signup" ? "Ready for the heat?" : "Back for more?"}</Text>
          <Text style={styles.formDescription}>No account needed to leave an anonymous roast.</Text>
          {!!user && <Notice tone="success">You're signed in as {user.email}.</Notice>}
          {!isSupabaseConfigured && <Notice tone="info">Supabase isn't configured yet. Follow the setup guide in README.</Notice>}
          {!!error && <Notice>{error}</Notice>}
          {!!message && <Notice tone="success">{message}</Notice>}
          <View style={styles.socials}>
            <Button label="Continue with Google" icon="G" variant="outline" disabled={busy || !isSupabaseConfigured} onPress={() => { void signInWith("google"); }} />
            <View style={styles.socialRow}>
              <View style={styles.socialHalf}><Button label="GitHub" icon="⌘" variant="outline" disabled={busy || !isSupabaseConfigured} onPress={() => { void signInWith("github"); }} /></View>
              <View style={styles.socialHalf}><Button label="Apple" icon="●" variant="outline" disabled={busy || !isSupabaseConfigured} onPress={() => { void signInWith("apple"); }} /></View>
            </View>
          </View>
          <View style={styles.separator}><View style={styles.rule} /><Text style={styles.or}>OR WITH EMAIL</Text><View style={styles.rule} /></View>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="#AAA39B"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            secureTextEntry
            placeholder="At least 8 characters"
            placeholderTextColor="#AAA39B"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <Button
            label={mode === "signup" ? "Create account" : "Sign in"}
            loading={busy}
            disabled={!isSupabaseConfigured || !email.trim() || password.length < 8}
            onPress={() => { void submitEmail(); }}
          />
          <Pressable onPress={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setMessage(""); }}>
            <Text style={styles.toggle}>{mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}</Text>
          </Pressable>
          <Text style={styles.terms}>By continuing, you agree to keep it funny, not cruel. Public posts can be seen by anyone with the link.</Text>
        </Surface>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: { minHeight: "100%", paddingBottom: 38 },
  nav: { height: 74, paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  layout: { width: "100%", maxWidth: 1050, paddingHorizontal: 24, alignSelf: "center", flex: 1, flexDirection: "row", gap: 56, alignItems: "center", justifyContent: "center", paddingTop: 34 },
  layoutCompact: { flexDirection: "column", gap: 22, alignItems: "stretch", paddingTop: 20 },
  pitchCompact: { minWidth: 0 },
  pitch: { flex: 1, minWidth: 260 },
  eyebrow: { color: colors.orangeDark, fontSize: 11, fontWeight: "900", letterSpacing: 1.6, marginBottom: 18 },
  title: { fontSize: 50, lineHeight: 53, color: colors.ink, fontWeight: "900", letterSpacing: -2 },
  description: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 17, maxWidth: 370 },
  privacy: { color: colors.ink, fontSize: 12, lineHeight: 23, fontWeight: "700", marginTop: 24 },
  formCard: { width: "100%", maxWidth: 425, gap: 13 },
  formEyebrow: { color: colors.orangeDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  formTitle: { color: colors.ink, fontSize: 25, lineHeight: 30, fontWeight: "900", letterSpacing: -0.7 },
  formDescription: { color: colors.muted, fontSize: 13, marginTop: -8, marginBottom: 3 },
  socials: { gap: 9, marginTop: 4 },
  socialRow: { flexDirection: "row", gap: 9 },
  socialHalf: { flex: 1 },
  separator: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 1 },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  or: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  label: { color: colors.ink, fontSize: 12, fontWeight: "800", marginBottom: -7 },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 13, paddingHorizontal: 14, height: 47, fontSize: 14, color: colors.ink },
  toggle: { color: colors.orangeDark, textAlign: "center", fontSize: 12, fontWeight: "800", paddingTop: 3 },
  terms: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 1 },
});
