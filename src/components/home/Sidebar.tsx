'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Home, FileText, Folder, Clock, Star, Settings, Plus, User, LogOut, Feather } from 'lucide-react'
import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()

  const menuItems = [
    { icon: Home, label: 'Home', href: '/home' },
    { icon: Folder, label: 'Folders', href: '/folders' },
    { icon: FileText, label: 'All Documents', href: '/documents' },
    { icon: Clock, label: 'Recent', href: '/recent' },
    { icon: Star, label: 'Starred', href: '/starred' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ]

  const handleNewDocument = () => {
    // Navigate to the editor with 'new' route - ID will be generated server-side
    router.push('/editor/new')
  }

  return (
    <aside className={`${
      isCollapsed ? 'w-16' : 'w-64'
    } bg-white border-r border-brown-light/20 flex flex-col transition-all duration-300`}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-brown-light/20">
        <Link href={session ? "/home" : "/"} className={`flex items-center gap-2 ${isCollapsed ? 'hidden' : 'flex'}`}>
          <Feather className="w-6 h-6 text-brown-medium" />
          <span className="font-serif text-2xl text-ink">Suggi</span>
        </Link>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-stone-light rounded-lg transition-all duration-300 hover:shadow-md transform hover:scale-105 active:scale-95"
        >
          <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* New Document Button */}
      <div className="p-4">
        <button 
          onClick={handleNewDocument}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-ink text-paper rounded-xl hover:bg-ink/90 transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0 ${
            isCollapsed ? 'px-3' : ''
          }`}>
          <Plus className="w-5 h-5" />
          {!isCollapsed && <span>New Document</span>}
        </button>
      </div>



      {/* Navigation */}
      <nav className="flex-1 px-2">
        {menuItems.map((item, index) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={index}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 ${
                isActive 
                  ? 'bg-stone-light text-ink shadow-md' 
                  : 'text-ink/60 hover:bg-stone-light/50 hover:text-ink hover:shadow-sm'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User Profile & Sign Out */}
      <div className="p-4 border-t border-brown-light/20">
        {session?.user && (
          <div className="flex items-center gap-3 mb-3 px-3">
            <div className="w-8 h-8 bg-brown-light/30 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-ink" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{session.user.name}</p>
              <p className="text-xs text-ink/60 truncate">{session.user.email}</p>
            </div>
          </div>
        )}
        
        <button 
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-ink/60 hover:bg-stone-light/50 hover:text-ink transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 hover:shadow-sm"
        >
          <LogOut className="w-5 h-5" />
          {!isCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  )
}