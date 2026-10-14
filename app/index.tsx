import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Brand } from "@/components/Brand";
import { Button, Header, Notice, Surface } from "@/components/Primitives";
import { useAuth, isVerifiedUser } from "@/lib/auth";
import { colors, shadow } from "@/lib/theme";
import { isSupabaseConfigured, publicImageUrl, supabase } from "@/lib/supabase";

type Post = {
  id: string;
  kind: "text" | "image";
  body: string;
  image_path: string | null;
  created_at: string;
};

export default function HomeScreen() {
  const { user, loading, signOut } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const { width } = useWindowDimensions();
  const compact = width < 740;

  const loadPosts = useCallback(async () => {
    if (!supabase) {
      setFeedLoading(false);
      return;
    }
    setFeedLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("id,kind,body,image_path,created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) setFeedError(error.message);
    else {
      setPosts(data ?? []);
      setFeedError("");
    }
    setFeedLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    void loadPosts();
  }, [loadPosts]));

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <Header right={
        loading ? null : user
          ? <><Text numberOfLines={1} style={styles.headerEmail}>{user.email}</Text><Button label="Sign out" variant="outline" onPress={() => { void signOut(); }} /></>
          : <><Link href="/auth" asChild><Pressable><Text style={styles.signIn}>Sign in</Text></Pressable></Link><Button label="Join the roast" onPress={() => router.push("/auth")} /></>
      } />

      <View style={[styles.hero, compact && styles.heroCompact]}>
        <View style={styles.heroCopy}>
          <View style={styles.pill}><Text style={styles.pillText}>✳ THE INTERNET'S NICEST ROAST-OFF</Text></View>
          <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
            Got a thick skin?{"\n"}<Text style={styles.heroAccent}>Prove it.</Text>
          </Text>
          <Text style={styles.heroDescription}>
            Post your hot take, questionable fit, or deeply cursed creation. Share the link. Let strangers lovingly ruin your day.
          </Text>
          <View style={styles.heroActions}>
            <Button label="Get roasted" icon="↗" onPress={() => router.push(user && isVerifiedUser(user) ? "/create" : "/auth")} />
            <Text style={styles.noSignup}>You post. Anyone can roast. No commenter accounts.</Text>
          </View>
          <View style={styles.proofRow}>
            <Text style={styles.proofEmoji}>🔥</Text>
            <Text style={styles.proofText}>Zero clout required.{"\n"}One extremely roastable link.</Text>
          </View>
        </View>
        <View style={styles.heroArtWrap}>
          <View style={styles.heroGlow} />
          <View style={styles.heroCardBack} />
          <View style={styles.heroCard}>
            <Text style={styles.mockLabel}>TODAY'S MAIN CHARACTER</Text>
            <View style={styles.scribbleBox}>
              <Text style={styles.scribble}>¯\_(ツ)_/¯</Text>
              <View style={styles.sun}><Text style={styles.sunText}>☀</Text></View>
            </View>
            <Text style={styles.mockTitle}>my startup's logo</Text>
            <Text style={styles.mockCaption}>please be gentle (don't be)</Text>
            <View style={styles.mockDivider} />
            <View style={styles.mockComment}>
              <View style={styles.avatar}><Text style={styles.avatarText}>?</Text></View>
              <Text style={styles.mockQuote}>Looks like a CAPTCHA gave up.</Text>
            </View>
            <View style={styles.mockComment}>
              <View style={[styles.avatar, styles.avatarYellow]}><Text style={styles.avatarText}>?</Text></View>
              <Text style={styles.mockQuote}>Ship it. To the bin.</Text>
            </View>
          </View>
          <View style={styles.floatingTag}><Text style={styles.floatingTagText}>✦ ANONYMOUSLY, OF COURSE</Text></View>
        </View>
      </View>

      <View style={styles.howSection}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionEyebrow}>THE PROCESS</Text>
          <Text style={styles.sectionTitle}>Three steps to emotional growth.</Text>
        </View>
        <View style={[styles.steps, compact && styles.stepsCompact]}>
          {[
            { number: "01", icon: "📸", title: "Post your masterpiece", detail: "Text or image. Confidence optional." },
            { number: "02", icon: "🔗", title: "Drop the link", detail: "Put it in the group chat. Be brave." },
            { number: "03", icon: "🌶️", title: "Take the heat", detail: "Anonymous roasts. Public character development." },
          ].map((item) => (
            <View key={item.number} style={styles.stepCard}>
              <View style={styles.stepTop}><Text style={styles.stepNumber}>{item.number}</Text><Text style={styles.stepIcon}>{item.icon}</Text></View>
              <Text style={styles.stepTitle}>{item.title}</Text>
              <Text style={styles.stepDescription}>{item.detail}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.feedSection}>
        <View style={styles.feedHeading}>
          <View><Text style={styles.sectionEyebrow}>FRESH FROM THE FIRE</Text><Text style={styles.sectionTitle}>Roastable right now</Text></View>
          <Text style={styles.liveTag}>● LIVE</Text>
        </View>
        {!isSupabaseConfigured && <Notice tone="info">Connect Supabase to publish and browse community posts. Setup steps are in the README.</Notice>}
        {!!feedError && <Notice>{feedError}</Notice>}
        {feedLoading ? <Text style={styles.emptyText}>Checking what's on the grill…</Text>
          : posts.length ? <View style={[styles.feedGrid, compact && styles.feedGridCompact]}>
            {posts.map((post) => (
              <Link key={post.id} href={`/roast/${post.id}`} asChild>
                <Pressable style={styles.postCard}>
                  {post.kind === "image" && post.image_path
                    ? <Image source={{ uri: publicImageUrl(post.image_path) }} style={styles.postImage} />
                    : <View style={styles.postTextArt}><Text style={styles.postTextMark}>“</Text><Text numberOfLines={3} style={styles.postBody}>{post.body}</Text></View>}
                  <Text numberOfLines={2} style={styles.postCaption}>{post.kind === "image" ? post.body : "Open the post to add your roast ↗"}</Text>
                  <Text style={styles.postMeta}>ANONYMOUS ROASTS WELCOME</Text>
                </Pressable>
              </Link>
            ))}
          </View>
          : isSupabaseConfigured && <Surface style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🧯</Text>
            <Text style={styles.emptyTitle}>It's suspiciously quiet in here.</Text>
            <Text style={styles.emptyText}>Be the first to volunteer as tribute.</Text>
          </Surface>}
      </View>

      <View style={styles.footer}>
        <Brand />
        <Text style={styles.footerCopy}>Built for people who can laugh at themselves.{"\n"}Be funny, not cruel.</Text>
        <Link href="/create" asChild><Pressable><Text style={styles.footerLink}>Make a post ↗</Text></Pressable></Link>
        <Text style={styles.footerSmall}>Public posts and images are visible to anyone with the link.</Text>
      </View>
      <Text style={styles.authHint}>{user && !isVerifiedUser(user) ? "Confirm your email to create a post." : ""}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  pageContent: { paddingBottom: 24 },
  headerEmail: { maxWidth: 190, color: colors.muted, fontSize: 13 },
  signIn: { color: colors.ink, fontSize: 14, fontWeight: "800", paddingHorizontal: 14, paddingVertical: 12 },
  hero: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingTop: 36, paddingBottom: 58, flexDirection: "row", alignItems: "center", gap: 35, minHeight: 570 },
  heroCompact: { paddingTop: 32, flexDirection: "column", alignItems: "stretch", gap: 38, minHeight: 0 },
  heroCopy: { flex: 1.05, alignItems: "flex-start" },
  pill: { backgroundColor: "#FFF0C9", borderRadius: 99, paddingHorizontal: 13, paddingVertical: 9, marginBottom: 25 },
  pillText: { color: "#76551D", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  heroTitle: { color: colors.ink, fontSize: 68, lineHeight: 69, fontWeight: "900", letterSpacing: -3.6 },
  heroTitleCompact: { fontSize: 54, lineHeight: 55 },
  heroAccent: { color: colors.orange },
  heroDescription: { maxWidth: 470, color: colors.muted, fontSize: 17, lineHeight: 26, marginTop: 20 },
  heroActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 15, marginTop: 27 },
  noSignup: { maxWidth: 185, color: colors.muted, fontSize: 12, lineHeight: 18 },
  proofRow: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 30 },
  proofEmoji: { fontSize: 25 },
  proofText: { color: colors.ink, fontWeight: "700", fontSize: 12, lineHeight: 17 },
  heroArtWrap: { flex: 0.95, minHeight: 420, justifyContent: "center", alignItems: "center", position: "relative" },
  heroGlow: { position: "absolute", width: 340, height: 340, borderRadius: 170, backgroundColor: "#FFE8C9" },
  heroCardBack: { position: "absolute", width: "75%", height: 365, borderRadius: 24, backgroundColor: colors.yellow, transform: [{ rotate: "8deg" }, { translateX: 14 }, { translateY: 5 }] },
  heroCard: { width: "82%", maxWidth: 340, backgroundColor: colors.white, borderRadius: 24, padding: 22, transform: [{ rotate: "-3deg" }], ...shadow },
  mockLabel: { fontSize: 9, color: colors.muted, fontWeight: "900", letterSpacing: 1.2 },
  scribbleBox: { marginTop: 14, height: 158, borderRadius: 15, backgroundColor: "#F8E9D6", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" },
  scribble: { fontSize: 38, fontWeight: "800", color: colors.ink, transform: [{ rotate: "-8deg" }] },
  sun: { position: "absolute", right: 15, top: 10, width: 42, height: 42, backgroundColor: colors.yellow, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  sunText: { color: colors.orangeDark, fontSize: 27 },
  mockTitle: { color: colors.ink, fontWeight: "900", fontSize: 17, marginTop: 16 },
  mockCaption: { color: colors.muted, fontSize: 12, marginTop: 4 },
  mockDivider: { height: 1, backgroundColor: colors.line, marginVertical: 15 },
  mockComment: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 9 },
  avatar: { width: 25, height: 25, borderRadius: 13, backgroundColor: "#FFDCD2", alignItems: "center", justifyContent: "center" },
  avatarYellow: { backgroundColor: "#FFE7AA" },
  avatarText: { fontWeight: "900", color: colors.ink },
  mockQuote: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  floatingTag: { position: "absolute", left: 3, bottom: 43, backgroundColor: colors.ink, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 10, transform: [{ rotate: "-6deg" }] },
  floatingTagText: { color: colors.white, fontSize: 9, fontWeight: "900", letterSpacing: 0.9 },
  howSection: { paddingHorizontal: 24, paddingVertical: 60, backgroundColor: "#FFF1E5" },
  sectionHeading: { maxWidth: 1120, width: "100%", alignSelf: "center", marginBottom: 23 },
  sectionEyebrow: { color: colors.orangeDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.6, marginBottom: 8 },
  sectionTitle: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -0.8 },
  steps: { width: "100%", maxWidth: 1120, alignSelf: "center", flexDirection: "row", gap: 15 },
  stepsCompact: { flexDirection: "column" },
  stepCard: { flex: 1, minHeight: 158, backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 19, padding: 18 },
  stepTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 23 },
  stepNumber: { color: colors.orange, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  stepIcon: { fontSize: 23 },
  stepTitle: { color: colors.ink, fontSize: 15, fontWeight: "900", marginBottom: 7 },
  stepDescription: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  feedSection: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 24, paddingTop: 57, paddingBottom: 52, gap: 15 },
  feedHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 4 },
  liveTag: { color: colors.green, fontSize: 10, fontWeight: "900", letterSpacing: 1.1, marginBottom: 8 },
  feedGrid: { flexDirection: "row", gap: 15, flexWrap: "wrap" },
  feedGridCompact: { flexDirection: "column" },
  postCard: { width: "31.5%", flexGrow: 1, minWidth: 220, backgroundColor: colors.white, borderRadius: 19, padding: 14, borderWidth: 1, borderColor: colors.line, ...shadow },
  postImage: { width: "100%", height: 175, borderRadius: 13, backgroundColor: colors.soft },
  postTextArt: { minHeight: 175, padding: 18, borderRadius: 13, backgroundColor: "#F8E9D6", justifyContent: "center" },
  postTextMark: { color: colors.orange, fontSize: 52, lineHeight: 50, fontWeight: "900" },
  postBody: { color: colors.ink, fontSize: 18, lineHeight: 25, fontWeight: "800" },
  postCaption: { color: colors.ink, fontSize: 14, fontWeight: "800", marginTop: 12, lineHeight: 20 },
  postMeta: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.9, marginTop: 8 },
  emptyCard: { alignItems: "center", paddingVertical: 32 },
  emptyIcon: { fontSize: 30, marginBottom: 9 },
  emptyTitle: { color: colors.ink, fontWeight: "900", fontSize: 17 },
  emptyText: { color: colors.muted, fontSize: 13, marginTop: 6 },
  footer: { paddingHorizontal: 24, paddingTop: 27, borderTopWidth: 1, borderTopColor: colors.line, alignItems: "center", gap: 13 },
  footerCopy: { textAlign: "center", color: colors.muted, fontSize: 12, lineHeight: 18 },
  footerLink: { color: colors.orangeDark, fontSize: 13, fontWeight: "900" },
  footerSmall: { color: colors.muted, fontSize: 10, textAlign: "center" },
  authHint: { textAlign: "center", color: colors.muted, fontSize: 11, paddingTop: 12 },
});
