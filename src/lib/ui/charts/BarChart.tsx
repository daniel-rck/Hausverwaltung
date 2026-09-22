import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { CHART_LOCALE, type ChartValueFormat, formatTick, formatTooltipValue } from "./chartFormat";
import { useChartTheme } from "./useChartTheme";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type BarChartProps = {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
  stacked?: boolean;
  height?: number;
  /** Achsen-/Tooltip-Format; "euro" für Geldbeträge (Default: Zahl, de-DE). */
  valueFormat?: ChartValueFormat;
};

export function BarChart({
  labels,
  datasets,
  stacked = false,
  height = 250,
  valueFormat = "number",
}: BarChartProps) {
  const colors = ["#78716c", "#d97706", "#0891b2", "#16a34a", "#7c3aed"];
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
        locale: CHART_LOCALE,
        plugins: {
          legend: { position: "bottom", labels: { color: theme.text } },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label ?? ""}: ${formatTooltipValue(ctx.parsed.y, valueFormat)}`,
            },
          },
        },
        scales: {
          x: { stacked, ticks: { color: theme.text }, grid: { color: theme.grid } },
          y: {
            stacked,
            beginAtZero: true,
            ticks: { color: theme.text, callback: (v) => formatTick(v, valueFormat) },
            grid: { color: theme.grid },
          },
        },
      }}
    />
  );
}
