import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const styles: Record<Variant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover shadow-sm',
  secondary:
    'bg-surface text-[#334155] dark:text-body border border-[#E5E7EB] dark:border-line hover:bg-surface-2',
  ghost: 'bg-transparent text-body hover:bg-[#F3F4F6] dark:hover:bg-[#1E293B]',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: Props) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-btn font-medium transition-colors ${pad} ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
