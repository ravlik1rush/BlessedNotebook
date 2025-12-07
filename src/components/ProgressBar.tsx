import { cn } from '@/lib/utils';

interface ProgressBarProps {
  percentage: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  animated?: boolean;
}

export function ProgressBar({ 
  percentage, 
  size = 'md', 
  showLabel = false,
  className,
  animated = true,
}: ProgressBarProps) {
  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'flex-1 rounded-full bg-progress-track overflow-hidden',
        heights[size]
      )}>
        <div 
          className={cn(
            'h-full rounded-full progress-bar-fill transition-all duration-500 ease-out relative',
            animated && percentage > 0 && 'overflow-hidden'
          )}
          style={{ width: `${percentage}%` }}
        >
          {animated && percentage > 0 && percentage < 100 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-progress-shine" />
          )}
        </div>
      </div>
      {showLabel && (
        <span className={cn(
          'font-medium tabular-nums',
          size === 'sm' && 'text-xs',
          size === 'md' && 'text-sm',
          size === 'lg' && 'text-base',
          percentage === 100 ? 'text-success' : 'text-muted-foreground'
        )}>
          {percentage}%
        </span>
      )}
    </div>
  );
}
