import {
  createClientComponentClient,
  type SupabaseClient,
} from "@supabase/auth-helpers-nextjs";
import { useMockData } from "./config";

export type AppSupabaseClient = SupabaseClient | null;

export const supabase: AppSupabaseClient = useMockData
  ? null
  : createClientComponentClient();
