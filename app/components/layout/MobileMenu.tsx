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

  // Auto-close menu when any menu item is clicked
  const handleMenuItemClick = useCallback((originalHandler?: (...args: any[]) => void) => {
    return (...args: any[]) => {
      if (originalHandler) {
        originalHandler(...args);
      }
      closeMenu();
    };
  }, [closeMenu]);

  // Recursively clone children and add auto-close to all clickable elements
  const enhanceChildren = useCallback((children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        // If it's a button with onClick, wrap the onClick to auto-close
        if (child.type === 'button' && child.props.onClick) {
          return React.cloneElement(child as React.ReactElement<any>, {
            onClick: handleMenuItemClick(child.props.onClick),
            children: child.props.children ? enhanceChildren(child.props.children) : child.props.children
          });
        }
        // If it has children, recursively enhance them
        else if (child.props.children) {
          return React.cloneElement(child as React.ReactElement<any>, {
            children: enhanceChildren(child.props.children)
          });
        }
      }
      return child;
    });
  }, [handleMenuItemClick]);

  const enhancedChildren = enhanceChildren(children);

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
            <div className="mobile-menu-body">
              {enhancedChildren}
            </div>
          </div>
        </div>
      )}
    </>
  );
} 
