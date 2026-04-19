"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatInr } from "@/utils/formatCurrency";

export type RevenueChartPoint = { day: number; label: string; amount: number };

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
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
          <Tooltip
            formatter={(value) => [formatInr(typeof value === "number" ? value : 0), "Revenue"]}
            labelFormatter={(_, payload) =>
              payload?.[0] ? `Day ${(payload[0].payload as RevenueChartPoint).day}` : ""
            }
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#22c55e"
            fillOpacity={1}
            fill="url(#colorRev)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
