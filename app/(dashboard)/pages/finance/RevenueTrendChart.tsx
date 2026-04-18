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

export type RevenueChartPoint = { day: number; label: string; amount: number };

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Props = {
  chartData: RevenueChartPoint[];
  gridStroke: string;
};

export default function RevenueTrendChart({ chartData, gridStroke }: Props) {
  return (
    <div style={{ width: "100%", height: 300 }}>
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
