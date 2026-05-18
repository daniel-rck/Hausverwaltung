import { useMemo } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface ChartTheme {
  text: string;
  grid: string;
  border: string;
}

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();

  return useMemo(
    () =>
      theme === 'dark'
        ? { text: '#a1a1aa', grid: 'rgba(161,161,170,0.15)', border: '#27272a' }
        : { text: '#71717a', grid: 'rgba(113,113,122,0.12)', border: '#ffffff' },
    [theme],
  );
}
