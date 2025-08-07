import { Moon, Sun } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check for saved theme preference or default to system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      setIsDark(true);
      document.documentElement.setAttribute('data-appearance', 'dark');
    } else {
      setIsDark(false);
      document.documentElement.setAttribute('data-appearance', 'light');
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    
    if (newIsDark) {
      document.documentElement.setAttribute('data-appearance', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-appearance', 'light');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className="gap-2 border-2"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        backgroundColor: isDark ? 'var(--background)' : 'var(--foreground)',
        color: isDark ? 'var(--foreground)' : 'var(--background)',
        borderColor: isDark ? 'var(--border)' : 'var(--foreground)',
      }}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      {isDark ? 'Light' : 'Dark'}
    </Button>
  );
}
