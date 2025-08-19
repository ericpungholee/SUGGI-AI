'use client'
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export default function NavBar() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        }
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm' : 'bg-transparent'
            }`}>
            <div className='max-w-7xl mx-auto px-6 lg:px-8'>
                <div className='flex justify-between items-center h-16'>
                    <div className='flex items-center'>
                        <Link href="/" className="flex items-center">
                            <Image
                                src="/journal-ai-high-resolution-logo-transparent (2).png"
                                alt="Suggi Logo"
                                width={40}
                                height={40}
                                className="w-10 h-10"
                            />
                            <span className="ml-3 text-2xl font-serif text-ink">Suggi</span>
                        </Link>
                    </div>
                    <div className="hidden md:flex items-center space-x-8">
                        <Link href="#features" className="text-ink/70 hover:text-ink transition-colors">
                            Features
                        </Link>
                        <Link href="#" className="text-ink/70 hover:text-ink transition-colors">
                            About
                        </Link>
                        <Link href="#" className="text-ink/70 hover:text-ink transition-colors">
                            Pricing
                        </Link>

                        <Link
                            href="/home"
                            className="px-6 py-2 bg-ink text-paper rounded-full hover:bg-ink/90 transition-all hover:shadow-lg transform hover:-translate-y-0.5"
                        >
                            Start Writing
                        </Link>
                    </div>
                </div>
            </div>

        </nav>
    )
}
