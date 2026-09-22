import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { CHART_LOCALE, type ChartValueFormat, formatTooltipValue } from "./chartFormat";
import { useChartTheme } from "./useChartTheme";

ChartJS.register(ArcElement, Tooltip, Legend);

type DonutChartProps = {
  labels: string[];
  data: number[];
  colors?: string[];
  height?: number;
  /** Tooltip-Format; "euro" für Geldbeträge (Default: Zahl, de-DE). */
  valueFormat?: ChartValueFormat;
};

const defaultColors = [
  "#78716c",
  "#d97706",
  "#0891b2",
  "#16a34a",
  "#7c3aed",
  "#e11d48",
  "#059669",
  "#2563eb",
  "#ca8a04",
];

export function DonutChart({
  labels,
  data,
  colors = defaultColors,
  height = 250,
  valueFormat = "number",
}: DonutChartProps) {
  const theme = useChartTheme();

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
            borderColor: theme.border,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        locale: CHART_LOCALE,
        plugins: {
          legend: { position: "bottom", labels: { color: theme.text } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${formatTooltipValue(ctx.parsed, valueFormat)}`,
            },
          },
        },
      }}
    />
  );
}
