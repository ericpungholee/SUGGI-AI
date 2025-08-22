import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma) as any,
    secret: process.env.NEXTAUTH_SECRET,
    debug: process.env.NODE_ENV === "development",
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
        signIn: "/auth/login",
        error: "/auth/error",
    },
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },

            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Invalid Credentials")
                }
                
                try {
                    const user = await prisma.user.findUnique({
                        where: {
                            email: credentials.email
                        }
                    })

                    if (!user || !user.password) {
                        throw new Error("Invalid Credentials")
                    }

                    const isCorrectPassword = await bcrypt.compare(credentials.password, user.password)

                    if (!isCorrectPassword) {
                        throw new Error("Invalid Credentials")
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.image,
                    }
                } catch (error) {
                    console.error("Auth error:", error);
                    throw new Error("Authentication failed")
                }
            }
        }),
    ],
    callbacks: {
        async jwt({token, user}) {
            try {
                if (user) {
                    token.id = user.id;
                    token.email = user.email;
                    token.name = user.name;
                    token.image = user.image;
                }

                const dbUser = await prisma.user.findFirst({
                    where: {
                        email: token.email!,
                    },
                })

                if (dbUser) {
                    token.id = dbUser.id;
                    token.email = dbUser.email;
                    token.name = dbUser.name;
                    token.image = dbUser.image;
                }

                return token;
            } catch (error) {
                console.error("JWT callback error:", error);
                return token;
            }
        },
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id as string;
                session.user.email = token.email as string;
                session.user.name = token.name as string;
                session.user.image = token.image as string;
            }
            return session;
        }
    }
}