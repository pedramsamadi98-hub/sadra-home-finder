import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_UPDATE_INTERVAL } from "@/lib/brokers";

export interface AppSettings {
  user_id: string;
  /** Global default interval for the broker update system, in days. */
  broker_default_interval_days: number;
}

/** Reads the user's settings, falling back to the built-in defaults. */
export async function fetchSettings(userId: string): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return { user_id: userId, broker_default_interval_days: DEFAULT_UPDATE_INTERVAL };
  }
  return {
    user_id: userId,
    broker_default_interval_days:
      data.broker_default_interval_days || DEFAULT_UPDATE_INTERVAL,
  };
}

export async function setBrokerDefaultInterval(userId: string, days: number) {
  const value = days > 0 ? Math.round(days) : DEFAULT_UPDATE_INTERVAL;
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { user_id: userId, broker_default_interval_days: value },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}
