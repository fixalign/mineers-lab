import { mockUsers, type MockUser } from './mockData'

const STORAGE_KEY = 'mineers-mock-session'

type StoredUser = Pick<MockUser, 'id' | 'email' | 'role'>

const toStoredUser = (user: MockUser): StoredUser => ({
	id: user.id,
	email: user.email,
	role: user.role,
})

const readFromStorage = (): StoredUser | null => {
	if (typeof window === 'undefined') return mockUsers[0] ? toStoredUser(mockUsers[0]) : null
	const raw = window.localStorage.getItem(STORAGE_KEY)
	if (!raw) return null
	try {
		return JSON.parse(raw) as StoredUser
	} catch {
		return null
	}
}

const writeToStorage = (user: StoredUser | null) => {
	if (typeof window === 'undefined') return
	if (!user) {
		window.localStorage.removeItem(STORAGE_KEY)
		return
	}
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export const mockSignIn = async (email: string, password: string) => {
	const user = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password)
	if (!user) {
		return { error: 'Invalid credentials', user: null }
	}
	const stored = toStoredUser(user)
	writeToStorage(stored)
	return { error: null, user: stored }
}

export const mockGetSession = async () => {
	const user = readFromStorage()
	if (!user) return null
	return { user }
}

export const mockGetUser = async () => readFromStorage()

export const mockSignOut = async () => {
	writeToStorage(null)
}



