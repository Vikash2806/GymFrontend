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

export type MemberJoinChartPoint = {
  month: number;
  label: string;
  count: number;
  year: number;
};

type Props = {
  chartData: MemberJoinChartPoint[];
  gridStroke: string;
  /** Chart height in px (default 300). */
  height?: number;
};

export default function NewMemberJoinTrendChart({ chartData, gridStroke, height = 300 }: Props) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            allowDecimals={false}
            tickFormatter={(v) => `${typeof v === "number" ? v : Number(v)}`}
          />
          <Tooltip
            formatter={(value) => [`${typeof value === "number" ? value : Number(value)}`, "New members"]}
            labelFormatter={(_, payload) =>
              payload?.[0]
                ? `${(payload[0].payload as MemberJoinChartPoint).label} ${(payload[0].payload as MemberJoinChartPoint).year}`
                : ""
            }
          />
          <Bar dataKey="count" radius={[8, 8, 2, 2]} maxBarSize={36}>
            {chartData.map((point) => (
              <Cell
                key={`${point.year}-${point.month}`}
                fill={point.count > 0 ? "#22c55e" : "#d1d5db"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
