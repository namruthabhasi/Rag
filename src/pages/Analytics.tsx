import React from 'react';
import { 
  TrendingUp, 
  Clock, 
  Target, 
  Activity
} from 'lucide-react';

export const Analytics: React.FC = () => {
  // Mock performance metrics
  const primaryMetrics = [
    { name: 'Average Latency', val: '142ms', change: '-4.2%', icon: Clock, desc: 'Average end-to-end retrieval time' },
    { name: 'Precision @ 5', val: '96.2%', change: '+0.8%', icon: Target, desc: 'Percentage of relevant documents retrieved' },
    { name: 'Recall Rate', val: '91.8%', change: '+1.5%', icon: Activity, desc: 'Proportion of total relevant items retrieved' },
    { name: 'nDCG @ 5', val: '0.925', change: '+0.012', icon: TrendingUp, desc: 'Normalized discounted cumulative gain' },
  ];

  // Daily queries mock data (last 14 days)
  const dailyQueries = [24, 28, 35, 30, 42, 38, 48, 55, 62, 58, 64, 70, 85, 78];
  
  // Latency trend mock data (last 10 periods)
  const latencyTrend = [165, 158, 160, 148, 142, 145, 138, 135, 140, 142];

  // Custom SVG Bar Chart drawing helper
  const renderQueriesChart = () => {
    const width = 500;
    const height = 140;
    const maxVal = Math.max(...dailyQueries);
    const barWidth = 18;
    const gap = 16;
    const paddingLeft = 30;
    const paddingTop = 15;
    
    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="font-mono text-[9px] text-[#9E9E9E]">
        {/* Horizontal grid lines */}
        <line x1={paddingLeft} y1={height - 25} x2={width} y2={height - 25} stroke="rgba(255,255,255,0.06)" />
        <line x1={paddingLeft} y1={height/2 - 5} x2={width} y2={height/2 - 5} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
        <line x1={paddingLeft} y1={paddingTop} x2={width} y2={paddingTop} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />

        {/* Y Axis labels */}
        <text x="5" y={paddingTop + 3} fill="rgba(255,255,255,0.3)">{maxVal}</text>
        <text x="5" y={height/2} fill="rgba(255,255,255,0.15)">{Math.round(maxVal/2)}</text>
        <text x="5" y={height - 22} fill="rgba(255,255,255,0.3)">0</text>

        {/* Bars */}
        {dailyQueries.map((val, idx) => {
          const x = paddingLeft + idx * (barWidth + gap);
          const barHeight = ((height - 25 - paddingTop) * val) / maxVal;
          const y = height - 25 - barHeight;

          return (
            <g key={idx} className="group">
              {/* Highlight background on hover */}
              <rect
                x={x - gap/2}
                y={paddingTop}
                width={barWidth + gap}
                height={height - 25 - paddingTop}
                fill="transparent"
                className="hover:fill-white/[0.01] transition-all cursor-pointer"
              />
              {/* Actual bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="rgba(255, 255, 255, 0.08)"
                rx="2"
                className="group-hover:fill-[#9EA9FF]/80 transition-all duration-300"
              />
              {/* Value label on hover */}
              <text
                x={x + barWidth/2}
                y={y - 6}
                textAnchor="middle"
                fill="#9EA9FF"
                className="opacity-0 group-hover:opacity-100 transition-opacity font-semibold duration-200"
              >
                {val}
              </text>
              {/* Day label */}
              <text
                x={x + barWidth/2}
                y={height - 8}
                textAnchor="middle"
                fill="rgba(255,255,255,0.2)"
              >
                {`D${idx + 1}`}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  // Custom SVG Line Chart drawing helper
  const renderLatencyChart = () => {
    const width = 500;
    const height = 140;
    const maxVal = Math.max(...latencyTrend) * 1.1; // 10% headroom
    const minVal = Math.min(...latencyTrend) * 0.9;
    const paddingLeft = 30;
    const paddingRight = 10;
    const paddingTop = 20;
    const paddingBottom = 25;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    const pointsCount = latencyTrend.length;

    // Calculate coordinates
    const coords = latencyTrend.map((val, idx) => {
      const x = paddingLeft + (chartWidth * idx) / (pointsCount - 1);
      const y = paddingTop + chartHeight - ((chartHeight * (val - minVal)) / (maxVal - minVal));
      return { x, y, val };
    });

    // Create path string
    const d = coords.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');

    // Area path string (under line)
    const areaD = `${d} L ${coords[coords.length - 1].x} ${height - paddingBottom} L ${coords[0].x} ${height - paddingBottom} Z`;

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="font-mono text-[9px] text-[#9E9E9E]">
        {/* Horizontal grid lines */}
        <line x1={paddingLeft} y1={height - paddingBottom} x2={width} y2={height - paddingBottom} stroke="rgba(255,255,255,0.06)" />
        <line x1={paddingLeft} y1={paddingTop + chartHeight/2} x2={width} y2={paddingTop + chartHeight/2} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
        <line x1={paddingLeft} y1={paddingTop} x2={width} y2={paddingTop} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />

        {/* Y Axis labels */}
        <text x="5" y={paddingTop + 3} fill="rgba(255,255,255,0.3)">{Math.round(maxVal)}ms</text>
        <text x="5" y={paddingTop + chartHeight/2 + 3} fill="rgba(255,255,255,0.15)">{Math.round((maxVal + minVal) / 2)}ms</text>
        <text x="5" y={height - paddingBottom + 3} fill="rgba(255,255,255,0.3)">{Math.round(minVal)}ms</text>

        {/* Gradient fill under line */}
        <path d={areaD} fill="url(#latencyGrad)" opacity="0.15" />
        
        {/* Actual line */}
        <path d={d} fill="none" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1.5" />

        {/* Dots on line */}
        {coords.map((c, idx) => (
          <g key={idx} className="group">
            <circle
              cx={c.x}
              cy={c.y}
              r="3"
              fill="#050505"
              stroke="#D8D3FF"
              strokeWidth="1.5"
              className="hover:r-4 transition-all cursor-pointer"
            />
            {/* Tooltip trigger area */}
            <circle
              cx={c.x}
              cy={c.y}
              r="12"
              fill="transparent"
              className="cursor-pointer"
            />
            {/* Tooltip label on hover */}
            <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <rect x={c.x - 25} y={c.y - 22} width="50" height="15" rx="3" fill="#080808" stroke="rgba(255,255,255,0.1)" />
              <text x={c.x} y={c.y - 12} textAnchor="middle" fill="#D8D3FF" className="font-semibold">{c.val}ms</text>
            </g>
          </g>
        ))}

        {/* Gradient Definition */}
        <defs>
          <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D8D3FF" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-heading font-medium text-[#F5F5F5] mb-1">
          Performance Analytics
        </h1>
        <p className="text-xs text-[#9E9E9E]">
          Track real-time indexing speeds, query retrieval precision metrics, and vector search latency benchmarks.
        </p>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {primaryMetrics.map((met) => {
          const Icon = met.icon;
          const isPositive = met.change.startsWith('+');

          return (
            <div key={met.name} className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#9E9E9E]">{met.name}</span>
                <div className="h-7 w-7 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-[#9E9E9E]">
                  <Icon size={14} />
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-heading font-semibold text-white">{met.val}</span>
                <span className={`text-[10px] font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {met.change}
                </span>
              </div>

              <p className="text-[10px] text-[#9E9E9E] leading-relaxed pt-1.5 border-t border-white/[0.03]">
                {met.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Grid: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Queries volume */}
        <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xs uppercase font-mono text-[#9E9E9E] tracking-wider font-semibold">
                Daily Retrieval Queries
              </h2>
              <span className="text-[10px] text-[#9E9E9E]">Query executions over the last 14 days</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-semibold text-white">716 Queries</span>
            </div>
          </div>
          <div className="pt-2">
            {renderQueriesChart()}
          </div>
        </div>

        {/* Latency Trends line */}
        <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xs uppercase font-mono text-[#9E9E9E] tracking-wider font-semibold">
                Average Latency Trend
              </h2>
              <span className="text-[10px] text-[#9E9E9E]">End-to-end response time tracking</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-semibold text-[#9EA9FF]">Avg: 142.5ms</span>
            </div>
          </div>
          <div className="pt-2">
            {renderLatencyChart()}
          </div>
        </div>
      </div>

      {/* Comparison and Distribution grids */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Retrieval modes comparison */}
        <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur space-y-4 md:col-span-2">
          <h2 className="text-xs uppercase font-mono text-[#9E9E9E] tracking-wider font-semibold">
            Retrieval Accuracy Benchmark
          </h2>
          <div className="space-y-4 pt-1">
            {[
              { name: 'Hybrid Fusion + Reranking (Optimal)', val: 97.4, details: 'Combines vector search, BM25 keywords, and Cross-Encoder re-evaluation' },
              { name: 'Dense Retrieval (Vector Search)', val: 89.2, details: 'Cosine vector similarities over text embeddings' },
              { name: 'Sparse Retrieval (BM25 Keyword)', val: 78.5, details: 'Exact keyword matching via inverted document index term weights' }
            ].map((benchmark) => (
              <div key={benchmark.name} className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-white font-medium">{benchmark.name}</span>
                  <span className="text-[#9EA9FF] font-semibold">{benchmark.val}%</span>
                </div>
                {/* Horizontal Progress Bar */}
                <div className="w-full bg-[#0d0d0d] h-2 rounded border border-white/[0.04] overflow-hidden">
                  <div 
                    className="bg-accent-grad h-full rounded" 
                    style={{ width: `${benchmark.val}%` }}
                  />
                </div>
                <span className="text-[10px] text-[#9E9E9E] block">{benchmark.details}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Operations distribution */}
        <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur space-y-4">
          <h2 className="text-xs uppercase font-mono text-[#9E9E9E] tracking-wider font-semibold">
            Query Classification
          </h2>
          <div className="space-y-4 pt-1">
            {[
              { name: 'Exact Identifier Queries', count: 342, pct: 47, desc: 'Articles, invoice IDs, SKU formats' },
              { name: 'Semantic Concept Queries', count: 268, pct: 38, desc: 'Policy summaries, safety definitions' },
              { name: 'Metadata Filtering Queries', count: 106, pct: 15, desc: 'Explicit jurisdiction or scope limits' }
            ].map((dist) => (
              <div key={dist.name} className="flex justify-between items-start gap-4">
                <div className="space-y-0.5 max-w-[70%]">
                  <span className="text-xs text-white font-medium block">{dist.name}</span>
                  <span className="text-[10px] text-[#9E9E9E] block leading-tight">{dist.desc}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-white font-semibold font-mono block">{dist.pct}%</span>
                  <span className="text-[10px] text-[#9E9E9E] font-mono block">{dist.count} runs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
