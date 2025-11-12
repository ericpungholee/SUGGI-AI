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
  // Calculate delay based on first line completion time: ~80ms per char * 27 chars = ~2160ms, add buffer
  const firstLineDuration = "Talk with your documents,".length * 80 + 300
  // Second line starts after calculated delay (ensures first line completes first)
  const secondLine = useTypingAnimation("automate your writing.", 80, firstLineDuration, 0, animationKey)

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
            {!firstLine.isComplete && secondLine.displayedText.length === 0 && (
              <span key="cursor-1" className="typing-cursor" aria-hidden="true"></span>
            )}
          </span>
          {firstLine.isComplete && (
            <span className="block mt-3 text-brown-medium">
              {secondLine.displayedText}
              {secondLine.displayedText.length > 0 && !secondLine.isComplete && (
                <span key="cursor-2" className="typing-cursor" aria-hidden="true"></span>
              )}
            </span>
          )}
        </h1>

        {/* Subtitle */}
        <p className={`text-lg md:text-xl text-ink/70 mb-12 max-w-3xl mx-auto leading-relaxed transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
          The writing app that understands your entire knowledge base. Write, search, organize, and automate all in one place.
        </p>

        {/* CTA Buttons */}
        <div className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-1000 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
          {session?.user ? (
            <Link
              href="/home"
              className="px-8 py-4 bg-ink text-paper rounded-full text-lg font-medium hover:bg-ink/90 transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0 border-2 border-ink"
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link
              href="/auth/register"
              className="px-8 py-4 bg-ink text-paper rounded-full text-lg font-medium hover:bg-ink/90 transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0 border-2 border-ink"
            >
              Start Writing
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

