import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const NavContext = createContext();

export function NavProvider({ children }) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();

  // Automatically close mobile nav drawer on route navigation
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  const toggleMobileNav = () => setIsMobileNavOpen((prev) => !prev);
  const closeMobileNav = () => setIsMobileNavOpen(false);
  const openMobileNav = () => setIsMobileNavOpen(true);

  return (
    <NavContext.Provider
      value={{
        isMobileNavOpen,
        toggleMobileNav,
        closeMobileNav,
        openMobileNav
      }}
    >
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const context = useContext(NavContext);
  if (!context) {
    return {
      isMobileNavOpen: false,
      toggleMobileNav: () => {},
      closeMobileNav: () => {},
      openMobileNav: () => {}
    };
  }
  return context;
}
