'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sun, Moon, Menu, X, Cpu } from 'lucide-react';

export default function Header() {
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [mobileMenuLeftOpen, setMobileMenuLeftOpen] = useState(false);
  const [mobileMenuRightOpen, setMobileMenuRightOpen] = useState(false);

  // Sync theme with body class
  useEffect(() => {
    if (isLightTheme) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [isLightTheme]);

  return (
    <header className="w-full grid grid-cols-3 items-center px-6 py-3 z-[60] relative border-b border-card-border/20 bg-background/80 backdrop-blur-xl shrink-0">
      
      {/* Left Side: Nav Links */}
      <div className="flex items-center gap-4">
        <button 
          className="md:hidden p-2 hover:bg-card-border/20 rounded-lg"
          onClick={() => setMobileMenuLeftOpen(!mobileMenuLeftOpen)}
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuLeftOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-text-secondary">
          <Link href="#docs" className="hover:text-foreground transition-colors">Docs</Link>
          <Link href="#blog" className="hover:text-foreground transition-colors">Blog</Link>
          <Link href="#about" className="hover:text-foreground transition-colors">About</Link>
        </nav>
      </div>

      {/* Center: Logo + Name + Slogan */}
      <Link href="/dashboard" className="flex items-center gap-2.5 justify-center group">
        <Image 
          src="/logo.png" 
          alt="Elogant Logo" 
          width={32} 
          height={32} 
          className="object-contain animate-pulse shadow shadow-cyan-500/10 group-hover:[animation-play-state:paused] transition-transform"
        />
        <div className="flex items-center gap-1.5">
          <div className="flex flex-col w-fit">
            <div className="flex justify-between w-full font-extrabold text-xl font-sans">
              {'ELOGANT'.split('').map((ch, i) => (
                <span key={i}>{ch}</span>
              ))}
            </div>
            <span className="block text-[8.5px] font-semibold uppercase text-text-muted w-full text-center tracking-tighter whitespace-nowrap">Unlock your Hydrocarbon</span>
          </div>
          <div className="text-[9px] font-bold text-[#865be9] bg-[#865be9]/10 px-1.5 py-0.5 rounded-sm">v1.1</div>
        </div>
      </Link>

      {/* Right Side: Actions & Theme Toggle */}
      <div className="flex items-center gap-4 justify-end">
        <button 
          onClick={() => setIsLightTheme(!isLightTheme)} 
          className="p-2 hover:bg-card-border/20 rounded-lg text-text-secondary hover:text-foreground transition-colors"
          title="Toggle color theme"
        >
          {isLightTheme ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <button 
          className="md:hidden p-2 hover:bg-card-border/20 rounded-lg text-text-secondary"
          onClick={() => setMobileMenuRightOpen(!mobileMenuRightOpen)}
          aria-label="Toggle Login Options"
        >
          <Cpu size={20} />
        </button>

        <nav className="hidden md:flex items-center gap-4 text-sm font-semibold">
          <Link href="/dashboard" className="px-3 py-1.5 text-text-secondary hover:text-foreground transition-colors">
            Log In
          </Link>
          <Link href="/dashboard" className="px-3 py-1.5 bg-gradient-to-r from-[#865be9] to-[#7542e5] hover:opacity-90 rounded-lg text-white transition-opacity shadow-md">
            Sign Up
          </Link>
        </nav>
      </div>

      {/* Mobile Left Menu Overlay */}
      {mobileMenuLeftOpen && (
        <div className="absolute top-full left-0 w-full bg-background/95 border-b border-card-border p-4 flex flex-col gap-3 z-50 md:hidden glass-panel">
          <Link href="#docs" onClick={() => setMobileMenuLeftOpen(false)} className="py-2 border-b border-card-border/20 text-text-secondary">Docs</Link>
          <Link href="#blog" onClick={() => setMobileMenuLeftOpen(false)} className="py-2 border-b border-card-border/20 text-text-secondary">Blog</Link>
          <Link href="#about" onClick={() => setMobileMenuLeftOpen(false)} className="py-2 text-text-secondary">About</Link>
        </div>
      )}

      {/* Mobile Right Menu Overlay */}
      {mobileMenuRightOpen && (
        <div className="absolute top-full right-0 w-full bg-background/95 border-b border-card-border p-4 flex flex-col gap-3 z-50 md:hidden glass-panel">
          <Link href="/dashboard" onClick={() => setMobileMenuRightOpen(false)} className="py-2 border-b border-card-border/20 text-center text-text-secondary">Log In</Link>
          <Link href="/dashboard" onClick={() => setMobileMenuRightOpen(false)} className="py-2 bg-gradient-to-r from-[#865be9] to-[#7542e5] text-center text-white rounded-lg">Sign Up</Link>
        </div>
      )}
    </header>
  );
}
