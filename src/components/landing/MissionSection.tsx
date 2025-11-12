'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useSession } from 'next-auth/react'

export default function MissionSection() {
  const { data: session } = useSession()

  return (
    <section className="py-16 px-6 bg-white">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-serif text-ink mb-8">
          Our Mission
        </h2>
        <p className="text-lg text-ink/70 mb-8 leading-relaxed">
          We believe writing should be seamless, intelligent, and context-aware. 
          Suggi eliminates the friction between thinking, writing, and organizing your ideas.
        </p>
        <p className="text-lg text-ink/70 mb-12 leading-relaxed">
          No more tab switching. No more lost context. No more hunting through cluttered interfaces. 
          Just write, with AI that actually understands your content.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {session?.user ? (
            <Link
              href="/home"
              className="px-8 py-4 bg-ink text-paper rounded-full text-lg font-medium hover:bg-ink/90 transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 border-2 border-ink"
            >
              Start Writing
              <ArrowRight className="w-5 h-5" />
            </Link>
          ) : (
            <Link
              href="/auth/register"
              className="px-8 py-4 bg-ink text-paper rounded-full text-lg font-medium hover:bg-ink/90 transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 border-2 border-ink"
            >
              Start Writing
              <ArrowRight className="w-5 h-5" />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

