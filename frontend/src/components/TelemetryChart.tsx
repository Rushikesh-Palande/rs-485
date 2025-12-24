import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Point = { t: number; v: number };

export function TelemetryChart(props: {
  title: string;
  points: Point[];
}) {
  const data = useMemo(() => {
    return props.points.map((p) => ({
      t: p.t,
      time: new Date(p.t).toLocaleTimeString(),
      v: p.v,
    }));
  }, [props.points]);

  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="cardHeader">
        <div style={{ fontWeight: 650 }}>{props.title}</div>
        <span className="pill">{props.points.length} pts</span>
      </div>
      <div className="cardBody" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="time" tick={{ fontSize: 12 }} minTickGap={20} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="v" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
