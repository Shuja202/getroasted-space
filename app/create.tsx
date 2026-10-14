import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Brand } from "@/components/Brand";
import { Button, Notice, Surface } from "@/components/Primitives";
import { useAuth, isVerifiedUser } from "@/lib/auth";
import { colors } from "@/lib/theme";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";

export default function CreateScreen() {
  const { user } = useAuth();
  const [kind, setKind] = useState<"text" | "image">("text");
  const [body, setBody] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function chooseImage() {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo access to choose an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageSize({ width: result.assets[0].width, height: result.assets[0].height });
    }
  }

  async function publish() {
    if (!user || !isVerifiedUser(user)) {
      setError("Sign in with a verified email before publishing.");
      return;
    }
    if (body.trim().length < 1 || body.trim().length > 2000) {
      setError("Add a post caption between 1 and 2,000 characters.");
      return;
    }
    if (kind === "image" && !imageUri) {
      setError("Choose an image for your post.");
      return;
    }
    setBusy(true);
    setError("");
    const client = requireSupabase();
    const postId = Crypto.randomUUID();
    let uploadedPath = "";
    try {
      if (kind === "image") {
        const resize = imageSize.width >= imageSize.height
          ? [{ resize: { width: Math.min(1600, imageSize.width) } }]
          : [{ resize: { height: Math.min(1600, imageSize.height) } }];
        const compressed = await manipulateAsync(imageUri, resize, {
          compress: 0.82,
          format: SaveFormat.JPEG,
        });
        const imageResponse = await fetch(compressed.uri);
        if (!imageResponse.ok) throw new Error("Couldn't prepare the selected image.");
        const bytes = await imageResponse.arrayBuffer();
        if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("The compressed image is over the 8 MB upload limit.");
        uploadedPath = `${user.id}/${postId}.jpg`;
        const { error: uploadError } = await client.storage.from("getroasted-images").upload(uploadedPath, bytes, {
          contentType: "image/jpeg",
          upsert: false,
        });
        if (uploadError) throw uploadError;
      }
      const { error: insertError } = await client.from("posts").insert({
        id: postId,
        user_id: user.id,
        kind,
        body: body.trim(),
        image_path: kind === "image" ? uploadedPath : null,
      });
      if (insertError) throw insertError;
      router.replace(`/roast/${postId}`);
    } catch (reason) {
      if (uploadedPath) {
        const { error: cleanupError } = await client.storage.from("getroasted-images").remove([uploadedPath]);
        if (cleanupError) console.error("Unable to clean up unused post image:", cleanupError.message);
      }
      setError(reason instanceof Error ? reason.message : "Couldn't publish your post.");
    } finally {
      setBusy(false);
    }
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.nav}><Brand /><Pressable onPress={() => router.back()}><Text style={styles.back}>← Back</Text></Pressable></View>
    <View style={styles.form}>
      <Text style={styles.eyebrow}>YOUR TURN IN THE SPOTLIGHT</Text>
      <Text style={styles.title}>Post your{"\n"}masterpiece.</Text>
      <Text style={styles.subtitle}>The internet has opinions. Give it something to work with.</Text>
      {!isSupabaseConfigured && <Notice tone="info">Connect Supabase first; see the setup guide in README.</Notice>}
      {!user && <Notice>Sign in to make a post. Anyone can roast a shared link without an account.</Notice>}
      {!!user && !isVerifiedUser(user) && <Notice>Verify your email before publishing. Check your inbox for the confirmation link.</Notice>}
      {!!error && <Notice>{error}</Notice>}
      <Surface style={styles.editor}>
        <View style={styles.tabs}>
          {(["text", "image"] as const).map((choice) => <Pressable
            key={choice}
            onPress={() => { setKind(choice); setError(""); }}
            style={[styles.tab, kind === choice && styles.tabActive]}
          ><Text style={[styles.tabText, kind === choice && styles.tabTextActive]}>{choice === "text" ? "✎  Text post" : "▧  Image post"}</Text></Pressable>)}
        </View>
        <Text style={styles.label}>{kind === "text" ? "What's getting roasted?" : "Add a caption"}</Text>
        <TextInput
          multiline
          maxLength={2000}
          placeholder={kind === "text" ? "My hot take is that tabs are better than spaces..." : "Describe your questionable masterpiece..."}
          placeholderTextColor="#AAA39B"
          value={body}
          onChangeText={setBody}
          style={[styles.input, kind === "text" && styles.textArea]}
          textAlignVertical="top"
        />
        <Text style={styles.counter}>{body.length}/2,000</Text>
        {kind === "image" && <>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" /> : null}
          <Button label={imageUri ? "Choose a different image" : "Choose an image"} icon="▧" variant="outline" onPress={() => { void chooseImage(); }} />
          <Text style={styles.helper}>JPEG, PNG, or WebP · up to 8 MB after compression. Your image will be re-encoded as a JPEG, stripping common location metadata.</Text>
        </>}
        <View style={styles.notice}><Text style={styles.noticeTitle}>A note before you post</Text><Text style={styles.noticeText}>Your post and image are public. Don't share private details, personal information, or anything you don't want passed around.</Text></View>
        <Button
          label="Publish & get your link"
          icon="↗"
          loading={busy}
          disabled={!isSupabaseConfigured || !user || !isVerifiedUser(user) || !body.trim() || (kind === "image" && !imageUri)}
          onPress={() => { void publish(); }}
        />
        <Text style={styles.finePrint}>Posts are reported by the community and may be hidden for review.</Text>
      </Surface>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: { minHeight: "100%", paddingBottom: 36 },
  nav: { height: 74, paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { color: colors.muted, fontSize: 13, fontWeight: "800", padding: 10 },
  form: { width: "100%", maxWidth: 660, alignSelf: "center", paddingHorizontal: 24, paddingTop: 30, gap: 13 },
  eyebrow: { color: colors.orangeDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  title: { color: colors.ink, fontSize: 48, lineHeight: 50, fontWeight: "900", letterSpacing: -2 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  editor: { gap: 14, padding: 20 },
  tabs: { flexDirection: "row", padding: 4, backgroundColor: colors.soft, borderRadius: 14, gap: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 11 },
  tabActive: { backgroundColor: colors.white },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  tabTextActive: { color: colors.ink },
  label: { color: colors.ink, fontSize: 13, fontWeight: "900", marginBottom: -8 },
  input: { minHeight: 84, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 14, padding: 14, fontSize: 14, lineHeight: 21, color: colors.ink },
  textArea: { minHeight: 150 },
  counter: { alignSelf: "flex-end", color: colors.muted, fontSize: 10, marginTop: -10 },
  preview: { height: 250, width: "100%", borderRadius: 15, backgroundColor: colors.soft },
  helper: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: -8 },
  notice: { backgroundColor: "#FFF7E7", borderRadius: 13, padding: 13 },
  noticeTitle: { color: colors.ink, fontSize: 12, fontWeight: "900", marginBottom: 4 },
  noticeText: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  finePrint: { color: colors.muted, fontSize: 10, textAlign: "center", marginTop: -6 },
});
