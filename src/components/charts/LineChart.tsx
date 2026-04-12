import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useChartTheme } from './useChartTheme';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

interface LineChartProps {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
  height?: number;
}

export function LineChart({ labels, datasets, height = 250 }: LineChartProps) {
  const colors = ['#78716c', '#d97706', '#0891b2', '#16a34a', '#7c3aed'];
  const theme = useChartTheme();

  return (
    <Line
      height={height}
      data={{
        labels,
        datasets: datasets.map((ds, i) => ({
          label: ds.label,
          data: ds.data,
          borderColor: ds.color ?? colors[i % colors.length],
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 3,
        })),
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: theme.text } },
        },
        scales: {
          x: { ticks: { color: theme.text }, grid: { color: theme.grid } },
          y: { beginAtZero: true, ticks: { color: theme.text }, grid: { color: theme.grid } },
        },
      }}
    />
  );
}
