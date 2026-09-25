import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { PushStore } from "./push.ts";

// PushStore backed by the service-role client.
export function supabasePushStore(admin: SupabaseClient): PushStore {
  return {
    pending: async (userId, businessId, sinceIso) => {
      const { data, error } = await admin
        .from("notifications")
        .select("id,kind,title,body,business_id")
        .eq("user_id", userId)
        .eq("business_id", businessId)
        .is("push_sent_at", null)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        businessId: row.business_id,
      }));
    },
    settings: async (userId) => {
      const { data } = await admin
        .from("user_settings")
        .select("notify_stamps,notify_rewards,notify_offers")
        .eq("user_id", userId)
        .maybeSingle();
      return data ?? null;
    },
    tokens: async (userId) => {
      const { data } = await admin.from("push_tokens").select("token").eq("user_id", userId);
      return (data ?? []).map((row) => row.token as string);
    },
    mark: async (ids, error, handled = true) => {
      if (!ids.length) return;
      await admin
        .from("notifications")
        .update(handled ? { push_sent_at: new Date().toISOString(), push_error: error } : { push_error: error })
        .in("id", ids);
    },
  };
}
