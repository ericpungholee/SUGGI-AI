import NavBar from "@/components/landing/NavBar"
import Hero from "@/components/landing/Hero"
import ProblemSection from "@/components/landing/ProblemSection"
import Features from "@/components/landing/Features"
import MissionSection from "@/components/landing/MissionSection"
import Footer from "@/components/landing/Footer"
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Home() {
  const session = await getServerSession(authOptions)
  
  // If user is authenticated, redirect to home
  if (session?.user) {
    redirect('/home')
  }
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-paper to-white hide-scrollbar">
      {/* Navigation */}
      <NavBar />

      {/* Hero Section */}
      <Hero />

      {/* Problem Section */}
      <ProblemSection />

      {/* Features Section */}
      <Features />

      {/* Mission Section */}
      <MissionSection />

      {/* Footer */}
      <Footer />
    </main>
  )
}
