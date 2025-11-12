'use client'

import { CheckCircle } from 'lucide-react'

const problems = [
  "Notion doesn't have a proper dashboard to see all your documents at a glance",
  "You constantly switch between writing, AI chat, and document reference",
  "AI doesn't know about your other documents - you have to copy-paste content",
  "Context is fragmented across different tools and applications",
  "No unified workspace for writing, AI assistance, and document management"
]

const solutions = [
  "Visual document dashboard with all your content at a glance",
  "Unified interface where everything works together seamlessly",
  "AI that understands ALL your documents, not just the current one",
  "Context-aware assistance across your entire knowledge base",
  "No more tab switching - write, chat, and reference in one place"
]

export default function ProblemSection() {
  return (
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
  )
}

