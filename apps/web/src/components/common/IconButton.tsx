import React from 'react';
import clsx from 'clsx';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  label?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  size = 'md',
  variant = 'ghost',
  label,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center select-none rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'w-7 h-7 text-[16px]',
    md: 'w-9 h-9 text-[18px]',
    lg: 'w-10 h-10 text-[20px]',
  }[size];

  const variantStyles = {
    primary: 'bg-primary-container text-on-primary hover:bg-primary shadow-sm',
    secondary: 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/60 hover:bg-surface-container hover:text-on-surface shadow-micro',
    ghost: 'bg-transparent text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
    destructive: 'bg-transparent text-error hover:bg-error-container/40',
  }[variant];

  return (
    <button
      aria-label={label || icon}
      title={label}
      className={clsx(baseStyles, sizeStyles, variantStyles, className)}
      disabled={disabled}
      {...props}
    >
      <span className="material-symbols-outlined leading-none">
        {icon}
      </span>
    </button>
  );
};
