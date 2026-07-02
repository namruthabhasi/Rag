import React from 'react';

interface ShimmerLoaderProps {
  type?: 'line' | 'card' | 'table';
  count?: number;
}

export const ShimmerLoader: React.FC<ShimmerLoaderProps> = ({ type = 'line', count = 3 }) => {
  const items = Array.from({ length: count });

  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((_, i) => (
          <div 
            key={i} 
            className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-4"
          >
            <div className="h-4 bg-white/[0.05] rounded w-1/3 animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 bg-white/[0.03] rounded w-full animate-pulse" />
              <div className="h-3 bg-white/[0.03] rounded w-5/6 animate-pulse" />
              <div className="h-3 bg-white/[0.03] rounded w-4/5 animate-pulse" />
            </div>
            <div className="h-3 bg-white/[0.05] rounded w-1/4 animate-pulse pt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-white/[0.01]">
        <div className="p-4 border-b border-white/[0.06] bg-white/[0.02] flex justify-between">
          <div className="h-4 bg-white/[0.06] rounded w-1/5 animate-pulse" />
          <div className="h-4 bg-white/[0.06] rounded w-1/6 animate-pulse" />
          <div className="h-4 bg-white/[0.06] rounded w-1/6 animate-pulse" />
          <div className="h-4 bg-white/[0.06] rounded w-1/12 animate-pulse" />
        </div>
        <div className="divide-y divide-white/[0.04]">
          {items.map((_, i) => (
            <div key={i} className="p-5 flex justify-between items-center">
              <div className="space-y-2 w-1/4">
                <div className="h-4 bg-white/[0.04] rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-white/[0.02] rounded w-1/2 animate-pulse" />
              </div>
              <div className="h-3.5 bg-white/[0.03] rounded w-1/6 animate-pulse" />
              <div className="h-3.5 bg-white/[0.03] rounded w-1/6 animate-pulse" />
              <div className="h-6 bg-white/[0.05] rounded w-12 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 w-full">
      {items.map((_, i) => (
        <div 
          key={i} 
          className="h-4 bg-white/[0.04] rounded w-full relative overflow-hidden"
        >
          {/* Shimmer overlay effect */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
        </div>
      ))}
    </div>
  );
};
