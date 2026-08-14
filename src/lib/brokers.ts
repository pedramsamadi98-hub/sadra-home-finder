import { supabase } from "@/integrations/supabase/client";

export interface Broker {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  agency: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type BrokerInput = Pick<Broker, "name" | "phone" | "agency" | "notes">;

export const emptyBroker: BrokerInput = {
  name: "",
  phone: "",
  agency: "",
  notes: "",
};

export async function fetchBrokers(): Promise<Broker[]> {
  const { data, error } = await supabase
    .from("brokers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Broker[];
}

export async function createBroker(input: BrokerInput, userId: string) {
  const { error } = await supabase.from("brokers").insert({ ...input, user_id: userId });
  if (error) throw error;
}

export async function updateBroker(id: string, input: BrokerInput) {
  const { error } = await supabase.from("brokers").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteBroker(id: string) {
  const { error } = await supabase.from("brokers").delete().eq("id", id);
  if (error) throw error;
}
