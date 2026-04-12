import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DonutChartProps {
  labels: string[];
  data: number[];
  colors?: string[];
  height?: number;
}

const defaultColors = [
  '#78716c',
  '#d97706',
  '#0891b2',
  '#16a34a',
  '#7c3aed',
  '#e11d48',
  '#059669',
  '#2563eb',
  '#ca8a04',
];

export function DonutChart({
  labels,
  data,
  colors = defaultColors,
  height = 250,
}: DonutChartProps) {
  return (
    <Doughnut
      height={height}
      data={{
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors.slice(0, data.length),
            borderWidth: 2,
            borderColor: '#fff',
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
      }}
    />
  );
}
