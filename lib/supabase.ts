import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("YOUR_PROJECT_REF"),
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        ...(Platform.OS === "web" ? {} : { storage: AsyncStorage }),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Connect a Supabase project to enable this feature. See the setup steps in README.");
  }
  return supabase;
}

export function publicImageUrl(path: string) {
  return requireSupabase().storage.from("getroasted-images").getPublicUrl(path).data.publicUrl;
}
