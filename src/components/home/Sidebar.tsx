'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Home, 
  FileText, 
  Folder, 
  Star, 
  Clock, 
  Search, 
  Settings,
  LogOut,
  User,
  Feather
} from 'lucide-react'

const navigation = [
  { name: 'Home', href: '/home', icon: Home },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Folders', href: '/folders', icon: Folder },
  { name: 'Starred', href: '/starred', icon: Star },
  { name: 'Recent', href: '/recent', icon: Clock },
  { name: 'Search', href: '/search', icon: Search },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push('/auth/login')
  }

  return (
    <aside className="w-64 bg-white border-r border-black flex flex-col h-full">
      {/* Logo/Header */}
      <div className="h-16 border-b border-black flex items-center px-6">
        <Link href="/home" className="flex items-center gap-2">
          <Feather className="w-8 h-8 text-brown-medium" />
          <span className="text-3xl font-serif text-ink">Suggi</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || 
              (item.href !== '/home' && pathname?.startsWith(item.href))
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-ink text-white' 
                      : 'text-ink/70 hover:bg-stone-light hover:text-ink'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="border-t border-black p-4">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-brown-light flex items-center justify-center">
            <User className="w-5 h-5 text-ink/70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate">
              {session?.user?.name || session?.user?.email || 'User'}
            </p>
            <p className="text-xs text-ink/60 truncate">
              {session?.user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-ink/70 hover:bg-stone-light hover:text-ink transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}

