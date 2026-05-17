import { useEffect } from 'react';

/**
 * Custom hook to fix iOS keyboard viewport offset issues
 * 
 * The problem: On iOS Safari, when the keyboard appears and then disappears,
 * the viewport sometimes doesn't reset properly, leaving the page scrolled/offset.
 * 
 * The solution: Detect keyboard events and force viewport restoration by:
 * 1. Listening for viewport height changes (keyboard show/hide indicator)
 * 2. Forcing a scroll to top when keyboard disappears
 * 3. Using setTimeout to ensure the fix happens after iOS finishes its animation
 */
export function useIOSKeyboardFix() {
  useEffect(() => {
    // Only run on iOS devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (!isIOS) return;

    let initialViewportHeight = window.visualViewport?.height || window.innerHeight;
    let isKeyboardOpen = false;

    const handleViewportChange = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDifference = initialViewportHeight - currentHeight;
      
      // Keyboard is considered open if viewport height decreased significantly (> 150px)
      const keyboardWasOpen = isKeyboardOpen;
      isKeyboardOpen = heightDifference > 150;
      
      // If keyboard just closed (was open, now closed), fix the viewport
      if (keyboardWasOpen && !isKeyboardOpen) {
        // Multiple restoration attempts to handle different iOS behaviors
        const restoreViewport = () => {
          // Force scroll to top
          window.scrollTo(0, 0);
          document.body.scrollTop = 0;
          document.documentElement.scrollTop = 0;
          
          // Force a repaint by toggling a style
          document.body.style.transform = 'translateZ(0)';
          requestAnimationFrame(() => {
            document.body.style.transform = '';
          });
        };
        
        // Immediate restoration
        restoreViewport();
        
        // Delayed restoration (after iOS animation completes)
        setTimeout(restoreViewport, 100);
        setTimeout(restoreViewport, 300);
        setTimeout(restoreViewport, 500);
      }
    };

    // Listen for input focus/blur events
    const handleInputFocus = () => {
      // Store the current viewport height when input is focused
      initialViewportHeight = window.visualViewport?.height || window.innerHeight;
    };

    const handleInputBlur = () => {
      // When input loses focus, schedule viewport restoration
      setTimeout(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
        
        // Force viewport refresh
        if (window.visualViewport) {
          window.dispatchEvent(new Event('resize'));
        }
      }, 100);
      
      // Additional delayed restoration for stubborn cases
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 500);
    };

    // Listen for visual viewport changes (most reliable)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }
    
    // Fallback: listen for window resize
    window.addEventListener('resize', handleViewportChange);
    
    // Listen to all input elements for focus/blur
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', handleInputFocus);
      input.addEventListener('blur', handleInputBlur);
    });

    // Observer to handle dynamically added inputs
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const newInputs = element.querySelectorAll('input, textarea');
            newInputs.forEach(input => {
              input.addEventListener('focus', handleInputFocus);
              input.addEventListener('blur', handleInputBlur);
            });
            
            // Check if the added node itself is an input
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
              element.addEventListener('focus', handleInputFocus);
              element.addEventListener('blur', handleInputBlur);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Cleanup
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }
      window.removeEventListener('resize', handleViewportChange);
      
      const inputs = document.querySelectorAll('input, textarea');
      inputs.forEach(input => {
        input.removeEventListener('focus', handleInputFocus);
        input.removeEventListener('blur', handleInputBlur);
      });
      
      observer.disconnect();
    };
  }, []);
} 