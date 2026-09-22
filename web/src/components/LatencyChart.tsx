"use client";

import { useMemo, useState } from "react";

/**
 * Response-time chart for the landing page preview.
 *
 * One series, so there is no legend — the heading names it. A legend box for a
 * single line is furniture.
 *
 * The samples are fixed, not random: a marketing page that redraws different
 * numbers on every load looks broken, and server and client markup must match
 * under static export or React throws a hydration mismatch.
 *
 * The one spike is deliberate. A flat line says nothing about what the product
 * is for; a chart that shows a blip being caught is the argument.
 */

/**
 * A 3x outlier would set the ceiling at 200 and squash the other 23 points
 * into a flat line in the bottom third — the spike would eat the whole axis
 * and the normal variation, which is the interesting part, would be
 * unreadable. Truncating the baseline to compensate is an anti-pattern, so
 * the spike is a believable 2x instead: still obviously an anomaly, and the
 * working range keeps real amplitude.
 */
const SAMPLES = [
  58, 52, 61, 66, 57, 71, 63, 55, 68, 78, 72, 60,
  54, 64, 124, 89, 74, 62, 57, 69, 65, 58, 53, 61,
];

const W = 680;
const H = 190;
const PAD = { top: 18, right: 14, bottom: 26, left: 40 };

export default function LatencyChart({
  title = "Response time",
  unit = "ms",
}: {
  title?: string;
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const geom = useMemo(() => {
    const max = Math.max(...SAMPLES);
    // Round the ceiling up to something a person would choose, so the axis
    // reads 200 rather than 187.
    const ceiling = Math.ceil(max / 50) * 50;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    const x = (i: number) => PAD.left + (i / (SAMPLES.length - 1)) * plotW;
    const y = (v: number) => PAD.top + plotH - (v / ceiling) * plotH;

    const points = SAMPLES.map((v, i) => ({ x: x(i), y: y(v), v, i }));
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L${x(SAMPLES.length - 1).toFixed(1)},${(PAD.top + plotH).toFixed(1)} L${PAD.left},${(PAD.top + plotH).toFixed(1)} Z`;

    const ticks = [0, ceiling / 2, ceiling];
    const avg = Math.round(SAMPLES.reduce((a, b) => a + b, 0) / SAMPLES.length);

    return { points, line, area, ticks, ceiling, plotH, avg, max, y, x };
  }, []);

  const active = hover != null ? geom.points[hover] : null;

  return (
    <figure className="latency-chart">
      <div className="latency-chart-head">
        <div>
          <span className="latency-chart-title">{title}</span>
          <span className="latency-chart-sub">last 24 checks · 30s interval</span>
        </div>
        <div className="latency-chart-stat">
          <strong>{geom.avg}</strong>
          <span>{unit} avg</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="latency-chart-svg"
        role="img"
        aria-label={`${title}: 24 checks averaging ${geom.avg}${unit}, peaking at ${geom.max}${unit}.`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="lcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3BD671" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#3BD671" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid and labels sit behind the data and stay recessive. */}
        {geom.ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={geom.y(t)}
              y2={geom.y(t)}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={geom.y(t) + 3.5}
              textAnchor="end"
              className="latency-chart-tick"
            >
              {t}
            </text>
          </g>
        ))}

        <path d={geom.area} fill="url(#lcFill)" className="latency-chart-area" />
        <path
          d={geom.line}
          fill="none"
          stroke="#3BD671"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          /* Normalises the path to length 1 so the CSS draw-in is exact for
             any geometry — a hardcoded dasharray has to guess, and guessed
             high means the line sits invisible for most of the animation. */
          pathLength={1}
          className="latency-chart-line"
        />

        {/* Crosshair. Drawn before the hit targets so it never eats a hover. */}
        {active && (
          <g pointerEvents="none">
            <line
              x1={active.x}
              x2={active.x}
              y1={PAD.top}
              y2={PAD.top + geom.plotH}
              stroke="rgba(255,255,255,0.24)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle r="5" cx={active.x} cy={active.y} fill="#3BD671" />
            {/* 2px surface ring, so the marker reads against the line under it. */}
            <circle r="5" cx={active.x} cy={active.y} fill="none" stroke="#0e1622" strokeWidth="2" />
          </g>
        )}

        {/* Hit targets wider than the marks, per column. */}
        {geom.points.map((p) => (
          <rect
            key={p.i}
            x={p.x - (W - PAD.left - PAD.right) / (SAMPLES.length - 1) / 2}
            y={PAD.top}
            width={(W - PAD.left - PAD.right) / (SAMPLES.length - 1)}
            height={geom.plotH}
            fill="transparent"
            onMouseEnter={() => setHover(p.i)}
          />
        ))}

        <text x={PAD.left} y={H - 8} className="latency-chart-tick">
          −12m
        </text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" className="latency-chart-tick">
          now
        </text>
      </svg>

      {active && (
        <div
          className="latency-chart-tip"
          style={{ left: `${(active.x / W) * 100}%` }}
          role="status"
        >
          <strong>{active.v}{unit}</strong>
          <span>check {active.i + 1} of {SAMPLES.length}</span>
        </div>
      )}

      {/* The numbers, for anyone who cannot use the plot. */}
      <figcaption className="sr-only">
        <table>
          <caption>{title} over the last {SAMPLES.length} checks</caption>
          <thead>
            <tr><th scope="col">Check</th><th scope="col">{title} ({unit})</th></tr>
          </thead>
          <tbody>
            {SAMPLES.map((v, i) => (
              <tr key={i}><th scope="row">{i + 1}</th><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
