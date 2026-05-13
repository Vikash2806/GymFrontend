"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatInr } from "@/utils/formatCurrency";

export type RevenueChartPoint = { month: number; label: string; amount: number; year: number };

type Props = {
  chartData: RevenueChartPoint[];
  gridStroke: string;
  /** Chart height in px (default 300). */
  height?: number;
};

export default function RevenueTrendChart({ chartData, gridStroke, height = 300 }: Props) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
          <Tooltip
            formatter={(value) => [formatInr(typeof value === "number" ? value : 0), "Revenue"]}
            labelFormatter={(_, payload) =>
              payload?.[0]
                ? `${(payload[0].payload as RevenueChartPoint).label} ${(payload[0].payload as RevenueChartPoint).year}`
                : ""
            }
          />
          <Bar
            dataKey="amount"
            radius={[8, 8, 2, 2]}
            maxBarSize={36}
          >
            {chartData.map((point) => (
              <Cell
                key={`${point.year}-${point.month}`}
                fill={point.amount > 0 ? "#22c55e" : "#d1d5db"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
