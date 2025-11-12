import Link from 'next/link'
import { Feather } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-brown-light/20 py-8 px-6">
      <div className="max-w-7xl mx-auto text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <Feather className="w-8 h-8 text-brown-medium" />
          <span className="text-3xl font-serif text-ink">Suggi</span>
        </Link>
        <p className="text-sm text-ink/60">
          © {new Date().getFullYear()} Suggi. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

