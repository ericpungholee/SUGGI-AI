'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Feather, LogIn, User } from 'lucide-react'

export default function NavBar() {
  const { data: session } = useSession()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-brown-light/20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-2">
            <Feather className="w-8 h-8 text-brown-medium" />
            <span className="text-3xl font-serif text-ink">Suggi</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            {session?.user ? (
              <Link
                href="/home"
                className="inline-flex items-center gap-2 bg-ink text-white px-4 py-2 rounded-lg hover:bg-ink/90 transition-colors"
              >
                <User className="w-4 h-4" />
                Dashboard
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 bg-ink text-white px-4 py-2 rounded-lg hover:bg-ink/90 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden">
            {session?.user ? (
              <Link
                href="/home"
                className="inline-flex items-center gap-2 bg-ink text-white px-3 py-2 rounded-lg text-sm"
              >
                <User className="w-4 h-4" />
                Dashboard
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 bg-ink text-white px-3 py-2 rounded-lg text-sm"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

