import { useEffect, useState } from 'react';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('guardiangate-theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('guardiangate-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('guardiangate-theme', 'light');
    }
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((d) => !d) };
}
