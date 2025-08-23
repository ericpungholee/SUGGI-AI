import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// Ensure we have a secret for JWT signing
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key-for-development-only'

export const authOptions: NextAuthOptions = {
  secret: NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  providers: [
    // Only add Google provider if environment variables are set
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    ] : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        try {
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email
            }
          })

          if (!user || !user.password) {
            throw new Error('Invalid credentials')
          }

          const isCorrectPassword = await bcrypt.compare(
            credentials.password,
            user.password
          )

          if (!isCorrectPassword) {
            throw new Error('Invalid credentials')
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image
          }
        } catch (error) {
          console.error('Auth error:', error)
          throw new Error('Authentication failed')
        }
      }
    }),
  ],
  callbacks: {
    async session({ token, session }) {
      if (token) {
        session.user.id = token.id as string
        session.user.name = token.name as string | null
        session.user.email = token.email as string
        session.user.image = token.image as string | null
      }
      return session
    },
    async jwt({ token, user }) {
      try {
        const dbUser = await prisma.user.findFirst({
          where: {
            email: token.email!,
          },
        })

        if (!dbUser) {
          if (user) {
            token.id = user?.id
          }
          return token
        }

        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          image: dbUser.image,
        }
      } catch (error) {
        console.error('JWT callback error:', error)
        return token
      }
    },
    async signIn({ user, account }) {
      try {
        // Create default folder for new users
        if (account?.provider === 'google') {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { folders: true }
          })
          
          if (existingUser && existingUser.folders.length === 0) {
            await prisma.folder.create({
              data: {
                name: 'My Documents',
                userId: existingUser.id,
              }
            })
          }
        }
        return true
      } catch (error) {
        console.error('SignIn callback error:', error)
        return true // Allow sign in even if folder creation fails
      }
    }
  },
  debug: process.env.NODE_ENV === 'development',
}