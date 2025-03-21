'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from '@/lib/supabase'
import { FaGithub } from 'react-icons/fa'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const router = useRouter()

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        })
        if (error) throw error
        setSuccessMessage('Please check your email for a verification link to complete your registration.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) throw error
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = async (provider: 'github') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      if (error) throw error
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    }
  }

  const handleForgotPassword = (e: React.MouseEvent) => {
    console.log('Forgot password clicked')
    // If the link doesn't work, we can try programmatic navigation
    router.push('/auth/forgot-password')
  }

  return (
    <div className="w-full max-w-md p-6 space-y-6 bg-white rounded-lg shadow-lg dark:bg-gray-800">
      <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
        {isSignUp ? 'Create an account' : 'Sign in to your account'}
      </h2>

      <form onSubmit={handleEmailAuth} className="space-y-4">
        <div>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {!isSignUp && (
          <div className="text-right">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Forgot password?
            </button>
          </div>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {successMessage && (
          <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={loading}
        >
          {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 text-gray-500 bg-white dark:bg-gray-800">
            Or continue with
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSocialLogin('github')}
        >
          <FaGithub className="mr-2" />
          GitHub
        </Button>
      </div>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          {isSignUp
            ? 'Already have an account? Sign in'
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  )
} 