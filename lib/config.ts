const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey)

export const useMockData =
	(process.env.NEXT_PUBLIC_USE_MOCK_DATA ?? process.env.USE_MOCK_DATA) === 'true' || !hasSupabaseEnv

export const supabaseConfig = {
	url: supabaseUrl,
	key: supabaseAnonKey,
}



