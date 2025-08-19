import NavBar from "@/components/landing/NavBar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-paper to-white">
      {/* Navigation */}
      <NavBar />

      {/* Hero Section */}
      <Hero />

      {/* Features Section */}
      <Features />
      
      {/* Footer */}
      <Footer />
    </main>
  );
}
