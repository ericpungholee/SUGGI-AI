'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Hero() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-20 w-72 h-72 bg-brown-light/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-brown-light/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="max-w-5xl mx-auto text-center">
        {/* Main heading */}
        <h1 className={`text-5xl md:text-6xl lg:text-7xl font-serif text-ink mb-8 transition-all duration-1000 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          Write with intention,
          <span className="block mt-3 text-brown-medium">create with purpose.</span>
        </h1>
        
        {/* Subtitle */}
        <p className={`text-lg md:text-xl text-ink/70 mb-12 max-w-3xl mx-auto leading-relaxed transition-all duration-1000 delay-200 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          A mindful writing space where your thoughts flow naturally. 
          Clean, distraction-free, and enhanced with intelligent assistance.
        </p>

        {/* CTA buttons */}
        <div className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-1000 delay-300 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <Link
            href="/home"
            className="px-8 py-4 bg-ink text-paper rounded-full text-lg font-medium hover:bg-ink/90 transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0"
          >
            Begin Writing
          </Link>
          <button className="px-8 py-4 bg-transparent border-2 border-ink/20 text-ink rounded-full text-lg font-medium hover:border-ink/40 hover:bg-ink/5 transition-all duration-300">
            View Demo
          </button>
        </div>


      </div>
    </section>
  )
}