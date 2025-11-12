import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// Test database connection
async function testDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}

// Ensure we have a secret for JWT signing
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key-for-development-only'
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    debug: process.env.NODE_ENV === 'development',
    // Add fallback for database connection issues
    pages: {
        signIn: '/auth/login',
        signUp: '/auth/register',
        error: '/auth/error' // Custom error page
    },
    providers: [
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    console.log('❌ Missing credentials')
                    return null
                }

                try {
                    // Test database connection first
                    const dbConnected = await testDatabaseConnection()
                    if (!dbConnected) {
                        console.error('❌ Database connection failed')
                        throw new Error('Database connection failed')
                    }

                    console.log('🔍 Attempting to find user:', credentials.email)
                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email }
                    })

                    if (!user || !user.password) {
                        console.log('❌ User not found or no password')
                        return null
                    }

                    const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

                    if (!isPasswordValid) {
                        console.log('❌ Invalid password')
                        return null
                    }

                    console.log('✅ User authenticated successfully:', user.id)
                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name
                    }
                } catch (error) {
                    console.error('❌ Auth error:', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined
                    })
                    return null
                }
            }
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
            }
            return token
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string
            }
            return session
        }
    },
    // Add error handling
    logger: {
        error(code, metadata) {
            console.error('NextAuth Error:', code, metadata)
        },
        warn(code) {
            console.warn('NextAuth Warning:', code)
        },
        debug(code, metadata) {
            if (process.env.NODE_ENV === 'development') {
                console.log('NextAuth Debug:', code, metadata)
            }
        }
    },
    // Add error handling for authentication failures
    events: {
        async signIn({ user, account, profile }) {
            console.log('🔐 User signed in:', user.email)
        },
        async signOut({ session, token }) {
            console.log('🔐 User signed out:', session?.user?.email || token?.email)
        },
        async session({ session, token }) {
            console.log('🔐 Session created:', session?.user?.email)
        },
        async error({ error, message }) {
            console.error('NextAuth Error Event:', { error, message })
        }
    },
    useSecureCookies: false, // Critical for localhost development
    cookies: {
        state: {
            name: `next-auth.state`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: false,
                maxAge: 24 * 60 * 60, // 24 hours in seconds
            }
        },
        pkceCodeVerifier: {
            name: `next-auth.pkce.code_verifier`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: false,
                maxAge: 24 * 60 * 60, // 24 hours in seconds
            }
        }
    },
    secret: NEXTAUTH_SECRET,
    trustHost: true
}