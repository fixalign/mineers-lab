import { useMockData } from './config'
import { supabase } from './supabaseClient'
import { mockGetSession, mockGetUser, mockSignIn, mockSignOut } from './mockAuth'

export type AppUser = {
	id: string
	email: string
	role: string | null
}

export type AppSession = {
	user: AppUser
}

const mapSupabaseUser = (user: any): AppUser => ({
	id: user?.id ?? '',
	email: user?.email ?? '',
	role: user?.user_metadata?.role ?? user?.raw_user_meta_data?.role ?? null,
})

export const signInWithEmail = async (email: string, password: string) => {
	if (useMockData) {
		const { user, error } = await mockSignIn(email, password)
		return {
			error,
			user: user
				? {
						id: user.id,
						email: user.email,
						role: user.role,
				  }
				: null,
		}
	}
	const { data, error } = await supabase!.auth.signInWithPassword({ email, password })
	if (error) return { error: error.message, user: null }
	const sessionUser = data.user ? mapSupabaseUser(data.user) : await getUser()
	if (!sessionUser) {
		return { error: 'Missing user profile', user: null }
	}
	return {
		error: null,
		user: sessionUser,
	}
}

export const getSession = async (): Promise<AppSession | null> => {
	if (useMockData) {
		const session = await mockGetSession()
		if (!session) return null
		return {
			user: {
				id: session.user.id,
				email: session.user.email,
				role: session.user.role,
			},
		}
	}
	const { data } = await supabase!.auth.getSession()
	const session = data.session
	if (!session?.user) return null
	return {
		user: mapSupabaseUser(session.user),
	}
}

export const getUser = async (): Promise<AppUser | null> => {
	if (useMockData) {
		const user = await mockGetUser()
		if (!user) return null
		return {
			id: user.id,
			email: user.email,
			role: user.role,
		}
	}
	const { data } = await supabase!.auth.getUser()
	return data.user ? mapSupabaseUser(data.user) : null
}

export const signOut = async () => {
	if (useMockData) {
		await mockSignOut()
		return
	}
	await supabase!.auth.signOut()
}


