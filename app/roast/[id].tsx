import { Link, router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Brand } from "@/components/Brand";
import { Button, Notice, Surface } from "@/components/Primitives";
import { submitCommunityAction } from "@/lib/community";
import { colors } from "@/lib/theme";
import { isSupabaseConfigured, publicImageUrl, supabase } from "@/lib/supabase";

type Post = {
  id: string;
  kind: "text" | "image";
  body: string;
  image_path: string | null;
  created_at: string;
};

type Roast = { id: string; post_id: string; body: string; created_at: string };
type ReportTarget = { type: "post" | "roast"; id: string };
const reasons = [
  { id: "harassment", label: "Harassment" },
  { id: "hate", label: "Hate" },
  { id: "explicit", label: "Explicit" },
  { id: "spam", label: "Spam" },
  { id: "other", label: "Other" },
] as const;

export default function RoastScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Array.isArray(id) ? id[0] : id;
  const [post, setPost] = useState<Post | null>(null);
  const [roasts, setRoasts] = useState<Roast[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !postId) {
      setLoading(false);
      if (!postId) setPageError("That share link is invalid.");
      return;
    }
    setLoading(true);
    const [postResult, roastResult] = await Promise.all([
      supabase.from("posts").select("id,kind,body,image_path,created_at").eq("id", postId).eq("status", "active").maybeSingle(),
      supabase.from("public_roasts").select("id,post_id,body,created_at").eq("post_id", postId).order("created_at", { ascending: false }),
    ]);
    if (postResult.error) setPageError(postResult.error.message);
    else if (!postResult.data) setPageError("This post is unavailable or has been hidden after reports.");
    else {
      setPost(postResult.data as Post);
      setPageError("");
    }
    if (roastResult.error) setPageError(roastResult.error.message);
    else setRoasts(roastResult.data ?? []);
    setLoading(false);
  }, [postId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  function shareUrl() {
    if (Platform.OS === "web" && typeof window !== "undefined") return window.location.href;
    const origin = process.env.EXPO_PUBLIC_SITE_URL || "https://getroasted.space";
    return `${origin.replace(/\/$/, "")}/roast/${postId}`;
  }

  async function sharePost() {
    try {
      const url = shareUrl();
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setMessage("Link copied. Go forth and distribute it.");
      } else {
        await Share.share({ message: `Roast me (lovingly): ${url}`, url });
        setMessage("Share link ready.");
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Couldn't share that link.");
    }
  }

  async function submitRoast() {
    if (!postId || body.trim().length < 1 || body.trim().length > 500) return;
    setBusy(true);
    setMessage("");
    try {
      await submitCommunityAction({ action: "roast", postId, body: body.trim() });
      setBody("");
      setMessage("Your roast is in. Anonymous legend.");
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Couldn't submit your roast.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReport(reason: typeof reasons[number]["id"]) {
    if (!reportTarget) return;
    setBusy(true);
    setMessage("");
    try {
      await submitCommunityAction({
        action: "report",
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        reason,
      });
      setMessage("Thanks. Your report was sent privately for review.");
      setReportTarget(null);
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Couldn't send the report.");
    } finally {
      setBusy(false);
    }
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.nav}><Brand /><Link href="/" asChild><Pressable><Text style={styles.back}>← Back to the grill</Text></Pressable></Link></View>
    <View style={styles.main}>
      {!isSupabaseConfigured && <Notice tone="info">Connect Supabase to load shared posts. Setup steps are in README.</Notice>}
      {!!message && <Notice tone={message.startsWith("Your roast") || message.startsWith("Thanks") || message.startsWith("Link copied") || message.startsWith("Share link") ? "success" : "error"}>{message}</Notice>}
      {loading ? <Text style={styles.loading}>Warming up the comments…</Text>
        : pageError ? <Surface style={styles.empty}><Text style={styles.emptyTitle}>No roast to see here.</Text><Text style={styles.meta}>{pageError}</Text><Button label="Back home" onPress={() => router.replace("/")} /></Surface>
        : post ? <>
          <View style={styles.heading}>
            <View><Text style={styles.eyebrow}>ONE LINK. NO MERCY.</Text><Text style={styles.title}>The roast is on.</Text></View>
            <Button label="Share your link" icon="↗" onPress={() => { void sharePost(); }} />
          </View>
          <Surface style={styles.post}>
            <View style={styles.postLabel}><Text style={styles.postLabelText}>THE VOLUNTEER</Text><Text style={styles.anon}>✦ AUTHOR PRIVATE</Text></View>
            {post.kind === "image" && post.image_path && <Image source={{ uri: publicImageUrl(post.image_path) }} style={styles.image} resizeMode="cover" />}
            <Text style={styles.postBody}>{post.body}</Text>
            <View style={styles.postBottom}>
              <Text style={styles.meta}>{new Date(post.created_at).toLocaleDateString()}</Text>
              <Pressable onPress={() => { setReportTarget({ type: "post", id: post.id }); setMessage(""); }}><Text style={styles.reportLink}>Report post</Text></Pressable>
            </View>
          </Surface>

          {reportTarget && <Surface style={styles.reportCard}>
            <Text style={styles.reportTitle}>What should we review?</Text>
            <Text style={styles.reportDescription}>Reports are private. Three reports hide an item while it awaits review.</Text>
            <View style={styles.reasons}>
              {reasons.map((reason) => <Pressable key={reason.id} disabled={busy} onPress={() => { void submitReport(reason.id); }} style={styles.reason}>
                <Text style={styles.reasonText}>{reason.label}</Text>
              </Pressable>)}
            </View>
            <Pressable onPress={() => setReportTarget(null)}><Text style={styles.cancel}>Cancel</Text></Pressable>
          </Surface>}

          <View style={styles.commentArea}>
            <View style={styles.commentHeading}>
              <View><Text style={styles.eyebrow}>THE COMMENT SECTION</Text><Text style={styles.commentTitle}>{roasts.length} {roasts.length === 1 ? "roast" : "roasts"} & counting</Text></View>
              <Text style={styles.noAccount}>NO ACCOUNT REQUIRED</Text>
            </View>
            <Surface style={styles.writeCard}>
              <Text style={styles.writeTitle}>Add your two cents</Text>
              <Text style={styles.writeDetail}>Make it clever. Make it kind enough to stay funny.</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="This has the energy of..."
                placeholderTextColor="#AAA39B"
                multiline
                maxLength={500}
                style={styles.input}
                textAlignVertical="top"
              />
              <View style={styles.submitRow}>
                <Text style={styles.meta}>{body.length}/500 · posted anonymously</Text>
                <Button label="Drop the roast" icon="↗" loading={busy} disabled={!body.trim() || body.trim().length > 500} onPress={() => { void submitRoast(); }} />
              </View>
            </Surface>
            {roasts.length ? roasts.map((roast, index) => <Surface key={roast.id} style={styles.roastCard}>
              <View style={styles.roastTop}><View style={styles.roastAvatar}><Text style={styles.roastAvatarText}>?</Text></View><Text style={styles.anonLabel}>ANONYMOUS ROASTER</Text><Text style={styles.meta}>{new Date(roast.created_at).toLocaleDateString()}</Text></View>
              <Text style={styles.roastBody}>{roast.body}</Text>
              <Pressable onPress={() => { setReportTarget({ type: "roast", id: roast.id }); setMessage(""); }}><Text style={styles.reportLink}>Report {index === 0 ? "roast" : "comment"}</Text></Pressable>
            </Surface>) : <Surface style={styles.firstRoast}><Text style={styles.firstEmoji}>🥁</Text><Text style={styles.firstTitle}>The mic is yours.</Text><Text style={styles.meta}>Be the first to leave a roast.</Text></Surface>}
          </View>
          <Text style={styles.footerNote}>Comments don't require an account. Your author identity is not stored with the roast.</Text>
        </> : null}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: { minHeight: "100%", paddingBottom: 40 },
  nav: { height: 74, paddingHorizontal: 24, width: "100%", maxWidth: 1120, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { color: colors.muted, fontWeight: "800", fontSize: 13, padding: 10 },
  main: { width: "100%", maxWidth: 770, alignSelf: "center", paddingHorizontal: 22, gap: 16 },
  loading: { textAlign: "center", marginTop: 90, color: colors.muted },
  empty: { alignItems: "center", gap: 14, marginTop: 55 },
  emptyTitle: { color: colors.ink, fontSize: 21, fontWeight: "900" },
  heading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, paddingTop: 20, paddingBottom: 7 },
  eyebrow: { color: colors.orangeDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 7 },
  title: { color: colors.ink, fontSize: 37, lineHeight: 42, fontWeight: "900", letterSpacing: -1.3 },
  post: { gap: 16 },
  postLabel: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  postLabelText: { color: colors.orangeDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  anon: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  image: { width: "100%", height: 340, borderRadius: 15, backgroundColor: colors.soft },
  postBody: { color: colors.ink, fontSize: 19, lineHeight: 29, fontWeight: "700" },
  postBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 13 },
  meta: { color: colors.muted, fontSize: 11 },
  reportLink: { color: colors.muted, fontSize: 11, fontWeight: "700", textDecorationLine: "underline", paddingVertical: 4 },
  reportCard: { padding: 16, gap: 11, borderColor: "#F1D89E" },
  reportTitle: { color: colors.ink, fontWeight: "900", fontSize: 15 },
  reportDescription: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  reasons: { flexDirection: "row", gap: 7, flexWrap: "wrap" },
  reason: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 99, backgroundColor: colors.paper },
  reasonText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  cancel: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  commentArea: { gap: 12, paddingTop: 18 },
  commentHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 },
  commentTitle: { color: colors.ink, fontSize: 24, fontWeight: "900", letterSpacing: -0.6 },
  noAccount: { color: colors.green, fontSize: 9, fontWeight: "900", letterSpacing: 0.7, paddingBottom: 4 },
  writeCard: { gap: 11 },
  writeTitle: { color: colors.ink, fontWeight: "900", fontSize: 15 },
  writeDetail: { color: colors.muted, fontSize: 11, marginTop: -7 },
  input: { minHeight: 86, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.white, padding: 13, color: colors.ink, fontSize: 13, lineHeight: 19 },
  submitRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  roastCard: { padding: 17, gap: 11 },
  roastTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  roastAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#FFE7AA", alignItems: "center", justifyContent: "center" },
  roastAvatarText: { fontWeight: "900", color: colors.ink },
  anonLabel: { flex: 1, color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.9 },
  roastBody: { color: colors.ink, fontSize: 15, fontWeight: "600", lineHeight: 22 },
  firstRoast: { alignItems: "center", padding: 22, gap: 8 },
  firstEmoji: { fontSize: 25 },
  firstTitle: { color: colors.ink, fontWeight: "900", fontSize: 16 },
  footerNote: { textAlign: "center", color: colors.muted, fontSize: 10, paddingTop: 4 },
});
