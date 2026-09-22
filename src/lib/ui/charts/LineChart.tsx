import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { CHART_LOCALE, type ChartValueFormat, formatTick, formatTooltipValue } from "./chartFormat";
import { useChartTheme } from "./useChartTheme";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type LineChartProps = {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
  height?: number;
  /** Achsen-/Tooltip-Format; "euro" für Geldbeträge (Default: Zahl, de-DE). */
  valueFormat?: ChartValueFormat;
};

export function LineChart({
  labels,
  datasets,
  height = 250,
  valueFormat = "number",
}: LineChartProps) {
  const colors = ["#78716c", "#d97706", "#0891b2", "#16a34a", "#7c3aed"];
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
          backgroundColor: "transparent",
          tension: 0.3,
          pointRadius: 3,
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
          x: { ticks: { color: theme.text }, grid: { color: theme.grid } },
          y: {
            beginAtZero: true,
            ticks: { color: theme.text, callback: (v) => formatTick(v, valueFormat) },
            grid: { color: theme.grid },
          },
        },
      }}
    />
  );
}
