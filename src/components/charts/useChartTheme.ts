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
        ? { text: '#a8a29e', grid: 'rgba(168,162,158,0.15)', border: '#292524' }
        : { text: '#78716c', grid: 'rgba(120,113,108,0.12)', border: '#ffffff' },
    [theme],
  );
}
