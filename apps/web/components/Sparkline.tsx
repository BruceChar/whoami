interface Props {
  values: number[];
  width?: number;
  height?: number;
}

/** 迷你 SVG 折线图（成长曲线） */
export default function Sparkline({ values, width = 300, height = 40 }: Props) {
  if (values.length < 2) {
    return <div className="h-10 text-xs leading-10 text-slate-600">（数据不足）</div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = Math.max(1, Math.floor(values.length / width));
  const sampled = values.filter((_, i) => i % step === 0 || i === values.length - 1);
  const pts = sampled.map((v, i) => {
    const x = (i / Math.max(1, sampled.length - 1)) * width;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={pts.join(" ")} fill="none" stroke="#7dd3fc" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2.5" fill="#7dd3fc" />
    </svg>
  );
}
