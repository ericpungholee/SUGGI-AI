import NavBar from "@/components/landing/NavBar";
import Footer from "@/components/landing/Footer";
import { Brain, Search, Bot, Layers, MessageSquare, Globe, ArrowRight, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function About() {
  const features = [
    {
      icon: Brain,
      title: 'Cross-Document Sources',
      description: 'AI fetches relevant information from all your documents to provide comprehensive answers.',
    },
    {
      icon: Search,
      title: 'Instant Discovery',
      description: 'Find anything across all your documents with lightning-fast semantic search.',
    },
    {
      icon: Bot,
      title: 'Automate Writing',
      description: 'AI types directly into your document with real-time suggestions and live editing.',
    },
    {
      icon: Layers,
      title: 'Unified Workspace',
      description: 'Write, chat with AI, and reference documents all in one seamless interface.',
    },
    {
      icon: MessageSquare,
      title: 'Talk with your documents',
      description: 'Chat with AI that understands your entire knowledge base, not just the current document.',
    },
    {
      icon: Globe,
      title: 'Web Intelligence',
      description: 'Access current information from the web when you need it, seamlessly integrated.',
    },
  ];

  const problems = [
    "Notion doesn't have a proper dashboard to see all your documents at a glance",
    "You constantly switch between writing, AI chat, and document reference",
    "AI doesn't know about your other documents - you have to copy-paste content",
    "Context is fragmented across different tools and applications",
    "No unified workspace for writing, AI assistance, and document management"
  ];

  const solutions = [
    "Visual document dashboard with all your content at a glance",
    "Unified interface where everything works together seamlessly",
    "AI that understands ALL your documents, not just the current one",
    "Context-aware assistance across your entire knowledge base",
    "No more tab switching - write, chat, and reference in one place"
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-paper to-white">
      {/* Navigation */}
      <NavBar />

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-ink mb-8">
            The writing app that actually gets it
          </h1>
          <p className="text-lg md:text-xl text-ink/70 mb-12 max-w-3xl mx-auto leading-relaxed">
            Suggi was built because we were tired of the fragmented writing workflow. 
            We put everything in one place: your documents, AI chat, and context - all working together seamlessly.
          </p>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif text-ink mb-6">
              The Problem We Solved
            </h2>
            <p className="text-lg text-ink/70 max-w-3xl mx-auto">
              Traditional writing workflows are broken. Here's what we were tired of:
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-ink mb-4">The Old Way</h3>
              {problems.map((problem, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-ink/70">{problem}</p>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-ink mb-4">The Suggi Way</h3>
              {solutions.map((solution, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-ink/70">{solution}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-white to-stone-light/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif text-ink mb-6">
              How We Do It
            </h2>
            <p className="text-lg text-ink/70 max-w-3xl mx-auto">
              Six core features that make Suggi different from every other writing app:
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group p-8 bg-white rounded-2xl border-4 border-black hover:shadow-2xl transition-all duration-700 hover:-translate-y-2"
                >
                  {/* Icon with white background and black border */}
                  <div className="w-14 h-14 bg-white border-4 border-black rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-7 h-7 text-black" strokeWidth={2.5} />
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-xl font-semibold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-black/70 leading-relaxed group-hover:text-black/80 transition-colors duration-300">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mission Section */}
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
            <Link
              href="/"
              className="px-8 py-4 bg-transparent border-2 border-ink/20 text-ink rounded-full text-lg font-medium hover:border-ink/40 hover:bg-ink/5 transition-all duration-300 flex items-center gap-2"
            >
              See How It Works
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/home"
              className="px-8 py-4 bg-ink text-paper rounded-full text-lg font-medium hover:bg-ink/90 transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0 flex items-center gap-2 border-2 border-ink"
            >
              Start Writing
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
