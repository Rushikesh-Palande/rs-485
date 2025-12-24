import React, { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import "echarts-gl";
import type { XY } from "../lib/downsample_lttb";

type Series = { name: string; points: XY[] };

/**
 * WebGL chart:
 * - Uses ECharts GL lineGL for much higher FPS than SVG.
 * - Designed for realtime updates (stable render budget).
 */
export function WebGLChart(props: { title: string; series: Series[]; height?: number }) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const option = useMemo(() => {
    return {
      backgroundColor: "transparent",
      title: {
        text: props.title,
        left: 12,
        top: 10,
        textStyle: { color: "#e2e8f0", fontSize: 12, fontWeight: 700 },
      },
      tooltip: { trigger: "axis" },
      legend: { top: 10, right: 12, textStyle: { color: "#cbd5e1" } },
      grid: { left: 56, right: 16, top: 44, bottom: 38 },
      xAxis: { type: "time", axisLabel: { color: "#94a3b8" }, splitLine: { show: false } },
      yAxis: {
        type: "value",
        axisLabel: { color: "#94a3b8" },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.12)" } },
      },
      dataZoom: [{ type: "inside" }, { type: "slider", height: 18 }],
      series: props.series.map((s) => ({
        name: s.name,
        type: "lineGL",
        symbol: "none",
        lineStyle: { width: 2 },
        data: s.points.map((p) => [p.x, p.y]),
      })),
    };
  }, [props.series, props.title]);

  useEffect(() => {
    if (!elRef.current) return;
    const chart = echarts.init(elRef.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    chart.setOption(option, { notMerge: true, lazyUpdate: true });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 shadow-2xl">
      <div ref={elRef} style={{ height: props.height ?? 340 }} />
    </div>
  );
}
