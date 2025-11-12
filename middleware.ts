import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { useMockData } from './lib/config'

export async function middleware(req: NextRequest) {
	if (useMockData) {
		return NextResponse.next()
	}
	const res = NextResponse.next()
	const supabase = createMiddlewareClient({ req, res })
	const {
		data: { session },
	} = await supabase.auth.getSession()

	const pathname = req.nextUrl.pathname
	const isLogin = pathname.startsWith('/login') || pathname.startsWith('/(auth)/login')
	const isAdmin = pathname.startsWith('/admin')
	const isLab = pathname.startsWith('/lab')

	if (!session && (isAdmin || isLab)) {
		return NextResponse.redirect(new URL('/login', req.url))
	}

	if (session && isLogin) {
		const role = (session.user as any)?.user_metadata?.role
		if (role === 'mineers') return NextResponse.redirect(new URL('/admin', req.url))
		if (role === 'lab') return NextResponse.redirect(new URL('/lab', req.url))
	}

	return res
}

export const config = {
	matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api)(.*)'],
}


