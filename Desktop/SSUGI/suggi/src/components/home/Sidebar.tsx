'use client'
import Link from 'next/link'
import { Home, FileText, Folder, Clock, Star, Settings, Plus, Search } from 'lucide-react'
import { useState } from 'react'

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const menuItems = [
    { icon: Home, label: 'Home', href: '/home', active: true },
    { icon: FileText, label: 'All Documents', href: '/home' },
    { icon: Clock, label: 'Recent', href: '/home' },
    { icon: Star, label: 'Starred', href: '/home' },
    { icon: Folder, label: 'Folders', href: '/home' },
  ]

  return (
    <aside className={`${
      isCollapsed ? 'w-16' : 'w-64'
    } bg-white border-r border-brown-light/20 flex flex-col transition-all duration-300`}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-brown-light/20">
        <Link href="/" className={`font-serif text-2xl text-ink ${isCollapsed ? 'hidden' : 'block'}`}>
          Suggi
        </Link>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-stone-light rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* New Document Button */}
      <div className="p-4">
        <button className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-ink text-paper rounded-xl hover:bg-ink/90 transition-all ${
          isCollapsed ? 'px-3' : ''
        }`}>
          <Plus className="w-5 h-5" />
          {!isCollapsed && <span>New Document</span>}
        </button>
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div className="px-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 bg-stone-light rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brown-light/30"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2">
        {menuItems.map((item, index) => {
          const Icon = item.icon
          return (
            <Link
              key={index}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg transition-all ${
                item.active 
                  ? 'bg-stone-light text-ink' 
                  : 'text-ink/60 hover:bg-stone-light/50 hover:text-ink'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Settings */}
      <div className="p-4 border-t border-brown-light/20">
        <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-ink/60 hover:bg-stone-light/50 hover:text-ink transition-all">
          <Settings className="w-5 h-5" />
          {!isCollapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  )
}