import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function middleware(req) {
        // Add CORS headers for API routes
        if (req.nextUrl.pathname.startsWith('/api/')) {
            const response = NextResponse.next()
            response.headers.set('Access-Control-Allow-Origin', '*')
            response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            return response
        }
        return NextResponse.next()
    },
    {
        callbacks: {
            authorized: ({ token, req }) => {
                // Allow API routes to pass through
                if (req.nextUrl.pathname.startsWith('/api/')) {
                    return true
                }
                // Require authentication for protected routes
                return !!token
            }
        },
    }
)

export const config = {
    matcher: [
      '/home/:path*',
      '/editor/:path*',
      '/settings/:path*',
    ]
  }