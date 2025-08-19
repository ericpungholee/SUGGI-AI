import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="py-16 px-6 bg-gradient-to-b from-stone-light to-brown-light/10">
      <div className="max-w-7xl mx-auto">
        {/* Main footer content */}
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand section */}
          <div className="md:col-span-2">
            <div className="mb-4">
              <span className="text-3xl font-serif text-ink">Suggi</span>
            </div>
            <p className="text-ink/70 mb-6 max-w-md leading-relaxed">
              A mindful writing space designed for creators who value clarity, focus, and intentional expression.
            </p>
            <div className="flex space-x-4">
              <button className="w-10 h-10 bg-ink/10 rounded-full flex items-center justify-center hover:bg-ink/20 transition-colors duration-300">
                <span className="text-ink text-sm">T</span>
              </button>
              <button className="w-10 h-10 bg-ink/10 rounded-full flex items-center justify-center hover:bg-ink/20 transition-colors duration-300">
                <span className="text-ink text-sm">G</span>
              </button>
              <button className="w-10 h-10 bg-ink/10 rounded-full flex items-center justify-center hover:bg-ink/20 transition-colors duration-300">
                <span className="text-ink text-sm">L</span>
              </button>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-semibold text-ink mb-4">Product</h3>
            <ul className="space-y-3">
              <li><Link href="#features" className="text-ink/60 hover:text-ink transition-colors duration-300">Features</Link></li>
              <li><Link href="#" className="text-ink/60 hover:text-ink transition-colors duration-300">Pricing</Link></li>
              <li><Link href="#" className="text-ink/60 hover:text-ink transition-colors duration-300">Updates</Link></li>
              <li><Link href="#" className="text-ink/60 hover:text-ink transition-colors duration-300">Roadmap</Link></li>
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h3 className="font-semibold text-ink mb-4">Company</h3>
            <ul className="space-y-3">
              <li><Link href="#" className="text-ink/60 hover:text-ink transition-colors duration-300">About</Link></li>
              <li><Link href="#" className="text-ink/60 hover:text-ink transition-colors duration-300">Blog</Link></li>
              <li><Link href="#" className="text-ink/60 hover:text-ink transition-colors duration-300">Careers</Link></li>
              <li><Link href="#" className="text-ink/60 hover:text-ink transition-colors duration-300">Contact</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="pt-8 border-t border-brown-light/20">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-ink/50 text-sm mb-4 md:mb-0">
              © 2025 Suggi. Crafted with care for writers everywhere.
            </p>
            <div className="flex space-x-6 text-sm">
              <Link href="#" className="text-ink/50 hover:text-ink transition-colors duration-300">Privacy</Link>
              <Link href="#" className="text-ink/50 hover:text-ink transition-colors duration-300">Terms</Link>
              <Link href="#" className="text-ink/50 hover:text-ink transition-colors duration-300">Cookies</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}