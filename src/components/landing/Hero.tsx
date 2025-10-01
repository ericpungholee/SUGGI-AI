'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

// Custom hook for typing animation with repeat
function useTypingAnimation(text: string, speed: number = 100, delay: number = 0, repeatInterval: number = 0, animationKey: number = 0) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

  // Reset function
  const reset = () => {
    setDisplayedText('')
    setCurrentIndex(0)
    setIsComplete(false)
    setHasStarted(false)
  }

  // Reset when animationKey changes
  useEffect(() => {
    reset()
  }, [animationKey])

  useEffect(() => {
    if (!hasStarted) {
      const timer = setTimeout(() => {
        setHasStarted(true)
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [delay, hasStarted])

  useEffect(() => {
    if (!hasStarted || currentIndex >= text.length) {
      if (currentIndex === text.length) {
        setIsComplete(true)
      }
      return
    }

    const timeout = setTimeout(() => {
      setDisplayedText(prev => prev + text[currentIndex])
      setCurrentIndex(prev => prev + 1)
    }, speed)

    return () => clearTimeout(timeout)
  }, [hasStarted, currentIndex, text, speed])

  return { displayedText, isComplete, reset }
}

export default function Hero() {
  const [mounted, setMounted] = useState(false)
  const [animationKey, setAnimationKey] = useState(0)
  const { data: session } = useSession()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset animation every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setAnimationKey(prev => prev + 1)
    }, 10000)
    
    return () => clearInterval(timer)
  }, [])

  // Typing animations for the main slogan with 10 second repeat
  const firstLine = useTypingAnimation("Talk with your documents,", 80, 0, 0, animationKey)
  const secondLine = useTypingAnimation("automate your writing.", 80, 2000, 0, animationKey) // Start after first line completes

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-20 w-72 h-72 bg-brown-light/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-brown-light/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="max-w-5xl mx-auto text-center">
        {/* Main heading with typing animation */}
        <h1 className={`text-5xl md:text-6xl lg:text-7xl font-serif text-ink mb-8 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
          <span className="block">
            {firstLine.displayedText}
            {firstLine.displayedText.length > 0 && !firstLine.isComplete && <span className="typing-cursor">|</span>}
          </span>
          <span className="block mt-3 text-brown-medium">
            {secondLine.displayedText}
            {secondLine.displayedText.length > 0 && !secondLine.isComplete && <span className="typing-cursor">|</span>}
          </span>
        </h1>

        {/* Subtitle */}
        <p className={`text-lg md:text-xl text-ink/70 mb-12 max-w-3xl mx-auto leading-relaxed transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
          AI that understands all your documents. Write, chat, and discover across your entire knowledge base in one unified workspace.
        </p>

        {/* CTA buttons */}
        <div className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
          <button className="px-8 py-4 bg-transparent border-2 border-ink/20 text-ink rounded-full text-lg font-medium hover:border-ink/40 hover:bg-ink/5 transition-all duration-300">
            See How It Works
          </button>
          <Link
            href={session ? "/home" : "/auth/login"}
            className="px-8 py-4 bg-ink text-paper rounded-full text-lg font-medium hover:bg-ink/90 transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0 border-2 border-ink"
          >
            {session ? "Open App" : "Start Writing"}
          </Link>
        </div>


      </div>
    </section>
  )
}