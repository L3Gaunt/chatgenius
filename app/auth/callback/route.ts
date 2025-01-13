import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
      const supabase = createRouteHandlerClient({ cookies })
      
      // Exchange the code for a session
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(new URL('/auth', request.url))
      }

      // Get the session to ensure it's established
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        // Session is established, redirect to home
        return NextResponse.redirect(new URL('/', request.url))
      }
    }

    // If no code or session establishment failed, redirect to auth
    return NextResponse.redirect(new URL('/auth', request.url))
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(new URL('/auth', request.url))
  }
} 