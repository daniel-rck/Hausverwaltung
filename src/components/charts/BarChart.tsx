import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useChartTheme } from './useChartTheme';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface BarChartProps {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
  stacked?: boolean;
  height?: number;
}

export function BarChart({
  labels,
  datasets,
  stacked = false,
  height = 250,
}: BarChartProps) {
  const colors = ['#78716c', '#d97706', '#0891b2', '#16a34a', '#7c3aed'];
  const theme = useChartTheme();

  return (
    <Bar
      height={height}
      data={{
        labels,
        datasets: datasets.map((ds, i) => ({
          label: ds.label,
          data: ds.data,
          backgroundColor: ds.color ?? colors[i % colors.length],
          borderRadius: 4,
        })),
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: theme.text } },
        },
        scales: {
          x: { stacked, ticks: { color: theme.text }, grid: { color: theme.grid } },
          y: { stacked, beginAtZero: true, ticks: { color: theme.text }, grid: { color: theme.grid } },
        },
      }}
    />
  );
}
