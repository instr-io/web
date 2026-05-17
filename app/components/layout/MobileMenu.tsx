'use client';

import { useState, useCallback } from 'react';
import React from 'react';

interface MobileMenuProps {
  children: React.ReactNode;
}

export function MobileMenu({ children }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleBodyClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (target.closest('button, a, [role="button"], .ui-clickable')) {
      closeMenu();
    }
  }, [closeMenu]);

  return (
    <>
      {/* Hamburger Button */}
      <button 
        className="mobile-menu-toggle"
        onClick={toggleMenu}
        aria-label="Toggle menu"
      >
        <div className={`hamburger ${isOpen ? 'open' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div 
          className="mobile-menu-overlay" 
          onClick={closeMenu}
        >
          <div 
            className="mobile-menu-content" 
            onClick={e => e.stopPropagation()}
          >
            <div className="mobile-menu-header">
              <h1 
                className="mobile-menu-title ui-clickable"
                onClick={() => window.location.href = window.location.origin}
                title="Go to main page"
              >
                instr.io
              </h1>
              <button 
                className="mobile-menu-close"
                onClick={closeMenu}
              >
                ×
              </button>
            </div>
            <div
              className="mobile-menu-body"
              onClick={handleBodyClick}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
} 
