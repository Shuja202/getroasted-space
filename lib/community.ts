import { requireSupabase } from "@/lib/supabase";

export async function submitCommunityAction(payload: Record<string, string>) {
  const { data, error } = await requireSupabase().functions.invoke("community-action", { body: payload });
  if (error) {
    if ("context" in error && error.context instanceof Response) {
      const responseBody: unknown = await error.context.json().catch(() => null);
      if (
        responseBody &&
        typeof responseBody === "object" &&
        "error" in responseBody &&
        typeof responseBody.error === "string"
      ) {
        throw new Error(responseBody.error);
      }
    }
    throw error;
  }
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }
}
