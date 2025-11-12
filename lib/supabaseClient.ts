import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useMockData } from "./config";

export const supabase = useMockData ? null : createClientComponentClient();

export type AppSupabaseClient = typeof supabase;
