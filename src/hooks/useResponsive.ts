import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface Responsive {
  bp:        Breakpoint;
  isMobile:  boolean;
  isTablet:  boolean;
  isDesktop: boolean;
  /** Sub-1024px — compact side panels, toolbars */
  isCompactLayout: boolean;
  /** Match legacy nav density (labels, admin chips) */
  isNarrowNav: boolean;
  /** Dense Kanban toolbar — swimlane row → select */
  isNarrowToolbar: boolean;
  w:         number;
}

export function useResponsive(): Responsive {
  const [w, setW] = useState(window.innerWidth);

  useEffect(() => {
    let raf = 0;
    const handle = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setW(window.innerWidth));
    };
    window.addEventListener('resize', handle, { passive: true });
    window.addEventListener('orientationchange', handle, { passive: true });
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('orientationchange', handle);
      cancelAnimationFrame(raf);
    };
  }, []);

  const bp: Breakpoint = w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
  return {
    bp,
    isMobile:  bp === 'mobile',
    isTablet:  bp === 'tablet',
    isDesktop: bp === 'desktop',
    isCompactLayout: w < 1024,
    isNarrowNav:     w < 900,
    isNarrowToolbar: w < 768,
    w,
  };
}
