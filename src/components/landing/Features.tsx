'use client'
import { FileText, Feather, Sparkles, Archive, Moon, Cloud } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

const features = [
  {
    icon: Feather,
    title: 'Pure Writing',
    description: 'Write without distractions. Focus on your words, not your environment.',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    icon: Sparkles,
    title: 'Intelligent Assistance',
    description: 'Thoughtful AI suggestions that enhance your writing while preserving your voice.',
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: Archive,
    title: 'Organized Naturally',
    description: 'Your documents and folders arranged like a personal library, always within reach.',
    color: 'from-green-500 to-emerald-500'
  },
  {
    icon: Moon,
    title: 'Day & Night',
    description: 'Gentle themes that adapt to your environment and protect your eyes.',
    color: 'from-indigo-500 to-purple-500'
  },
  {
    icon: Cloud,
    title: 'Always Saved',
    description: 'Your work automatically preserved in the cloud, accessible from anywhere.',
    color: 'from-orange-500 to-red-500'
  },
  {
    icon: FileText,
    title: 'Rich Formatting',
    description: 'All the tools you need, presented simply and beautifully.',
    color: 'from-teal-500 to-blue-500'
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
                className={`feature-card group p-8 bg-white/80 backdrop-blur-sm rounded-2xl border border-brown-light/20 hover:shadow-2xl transition-all duration-700 hover:-translate-y-2 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                {/* Icon with gradient background */}
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                
                {/* Content */}
                <h3 className="text-xl font-semibold text-ink mb-3 group-hover:text-brown-medium transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-ink/70 leading-relaxed group-hover:text-ink/80 transition-colors duration-300">
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