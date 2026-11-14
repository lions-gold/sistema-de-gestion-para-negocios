import React from 'react';

interface MaterialAssembleLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  variant?: 'full' | 'compact' | 'monochrome';
}

export const MaterialAssembleLogo: React.FC<MaterialAssembleLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  variant = 'full',
}) => {
  const iconDimensions = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }[size];

  const textSizeClasses = {
    xs: { title: 'text-xs', subtitle: 'text-[9px]' },
    sm: { title: 'text-sm', subtitle: 'text-[10px]' },
    md: { title: 'text-base sm:text-lg', subtitle: 'text-[10px] sm:text-xs' },
    lg: { title: 'text-lg sm:text-xl', subtitle: 'text-xs' },
    xl: { title: 'text-2xl sm:text-3xl', subtitle: 'text-sm' },
  }[size];

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Material Assemble Isometric Emblem */}
      <div className={`relative ${iconDimensions} shrink-0 group`}>
        {/* Ambient dynamic glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-blue-500/20 to-amber-500/10 rounded-2xl blur-sm opacity-75 group-hover:opacity-100 transition duration-300" />

        <svg
          viewBox="0 0 100 100"
          className="relative w-full h-full drop-shadow-md transition-transform duration-300 group-hover:scale-105"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="assemble-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
            <linearGradient id="assemble-blue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1E3A8A" />
            </linearGradient>
            <linearGradient id="assemble-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="assemble-plate" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
          </defs>

          {/* Base Material Plate */}
          <rect
            x="4"
            y="4"
            width="92"
            height="92"
            rx="22"
            fill="#111114"
            stroke="#27272A"
            strokeWidth="2.5"
          />

          {/* Upper Isometric Module (Golden Warehouse Block) */}
          <g>
            {/* Top facet */}
            <path
              d="M 50 16 L 76 31 L 50 46 L 24 31 Z"
              fill="url(#assemble-gold)"
              stroke="#FEF08A"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Right facet */}
            <path
              d="M 50 46 L 76 31 L 76 50 L 50 65 Z"
              fill="#D97706"
            />
            {/* Left facet */}
            <path
              d="M 24 31 L 50 46 L 50 65 L 24 50 Z"
              fill="#92400E"
            />
          </g>

          {/* Lower Isometric Module (Cobalt E-Commerce Logistics Block) */}
          <g>
            {/* Top facet */}
            <path
              d="M 50 52 L 76 67 L 50 82 L 24 67 Z"
              fill="url(#assemble-blue)"
              stroke="#93C5FD"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Right facet */}
            <path
              d="M 50 82 L 76 67 L 76 79 L 50 94 Z"
              fill="#1D4ED8"
            />
            {/* Left facet */}
            <path
              d="M 24 67 L 50 82 L 50 94 L 24 79 Z"
              fill="#1E3A8A"
            />
          </g>

          {/* Interlocking Monogram S Profile (White-Gold Assembly Joint) */}
          <path
            d="M 40 28 L 62 28 L 62 36 L 45 36 L 45 45 L 62 50 L 62 72 L 38 72 L 38 64 L 55 64 L 55 56 L 38 51 Z"
            fill="#FFFFFF"
            opacity="0.95"
            stroke="#F59E0B"
            strokeWidth="1"
            strokeLinejoin="round"
          />

          {/* Material Assemble Pinpoints */}
          <circle cx="50" cy="16" r="2.5" fill="#FEF08A" />
          <circle cx="76" cy="31" r="2.5" fill="#F59E0B" />
          <circle cx="24" cy="67" r="2.5" fill="#60A5FA" />
          <circle cx="50" cy="82" r="2.5" fill="#38BDF8" />
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 leading-none">
            <span className={`font-bold tracking-tight font-display text-zinc-50 whitespace-nowrap ${textSizeClasses.title}`}>
              Smith Solutions
            </span>
            <span className="text-amber-400 font-semibold text-[10px] sm:text-xs tracking-wider uppercase whitespace-nowrap">
              E-Commerce
            </span>
          </div>
          {variant !== 'compact' && (
            <span className={`text-zinc-400 font-mono tracking-wider mt-0.5 whitespace-nowrap ${textSizeClasses.subtitle}`}>
              Material Assemble · Venezuela
            </span>
          )}
        </div>
      )}
    </div>
  );
};
