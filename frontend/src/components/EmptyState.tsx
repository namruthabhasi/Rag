import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur max-w-md mx-auto py-12">
      <div className="h-12 w-12 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#9EA9FF] mb-4">
        <Icon size={22} />
      </div>
      <h3 className="text-base font-heading font-medium text-[#F5F5F5] mb-2">{title}</h3>
      <p className="text-xs text-[#9E9E9E] leading-relaxed mb-6 max-w-xs">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-[#9EA9FF] text-[#050505] hover:bg-[#D8D3FF] transition-all duration-300 shadow-[0_0_12px_rgba(158,169,255,0.15)] cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
