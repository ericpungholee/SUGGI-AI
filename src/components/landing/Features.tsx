'use client'
import { Brain, Search, Bot, Layers, MessageSquare, Globe } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

const features = [
  {
    icon: Brain,
    title: 'Cross-Document Sources',
    description: 'AI fetches relevant information from all your documents to provide comprehensive answers.',
    color: 'from-gray-800 to-gray-900'
  },
  {
    icon: Search,
    title: 'Instant Discovery',
    description: 'Find anything across all your documents with lightning-fast semantic search.',
    color: 'from-gray-700 to-gray-800'
  },
  {
    icon: Bot,
    title: 'Automate Writing',
    description: 'AI types directly into your document with real-time suggestions and live editing.',
    color: 'from-gray-900 to-black'
  },
  {
    icon: Layers,
    title: 'Unified Workspace',
    description: 'Write, chat with AI, and reference documents all in one seamless interface.',
    color: 'from-gray-600 to-gray-700'
  },
  {
    icon: MessageSquare,
    title: 'Talk with your documents',
    description: 'Chat with AI that understands your entire knowledge base, not just the current document.',
    color: 'from-gray-800 to-gray-900'
  },
  {
    icon: Globe,
    title: 'Web Intelligence',
    description: 'Access current information from the web when you need it, seamlessly integrated.',
    color: 'from-gray-700 to-gray-800'
  },
];

export default function Features() {
  const [visibleCards, setVisibleCards] = useState<number[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            setVisibleCards((prev) => [...new Set([...prev, index])]);
          }
        });
      },
      { threshold: 0.1 }
    );

    const cards = ref.current?.querySelectorAll('.feature-card');
    cards?.forEach((card, index) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" className="py-24 px-6 bg-gradient-to-b from-white to-stone-light/30">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif text-ink mb-6">
            Writing, refined.
          </h2>
          <p className="text-lg md:text-xl text-ink/60 max-w-3xl mx-auto leading-relaxed">
            Every feature thoughtfully crafted to support your creative process and enhance your writing experience.
          </p>
        </div>

        {/* Features grid */}
        <div ref={ref} className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isVisible = visibleCards.includes(index);

            return (
              <div
                key={index}
                data-index={index}
                className={`feature-card group p-8 bg-white rounded-2xl border-2 border-black hover:shadow-2xl transition-all duration-700 hover:-translate-y-2 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                {/* Icon with white background and black border */}
                <div className="w-14 h-14 bg-white border-2 border-black rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-7 h-7 text-black" strokeWidth={1.5} />
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
  );
}