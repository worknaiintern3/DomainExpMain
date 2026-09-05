import React from 'react';
import clsx from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  iconLeading?: string;
  iconTrailing?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  iconLeading,
  iconTrailing,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center select-none font-sans transition-all duration-150 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'h-7 px-2.5 gap-1 text-[11px] font-semibold leading-none',
    md: 'h-9 px-3.5 gap-1.5 text-label-md font-medium leading-none',
    lg: 'h-10 px-4 gap-2 text-body-sm font-semibold leading-none',
  }[size];

  const variantStyles = {
    primary: 'bg-primary-container text-on-primary hover:bg-primary shadow-sm active:scale-[0.99] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]',
    secondary: 'bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container-low shadow-micro',
    outline: 'bg-transparent text-on-surface border border-outline-variant/80 hover:bg-surface-container-low',
    ghost: 'bg-transparent text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
    destructive: 'bg-error-container/40 text-on-error-container border border-error-container hover:bg-error hover:text-on-error shadow-micro',
  }[variant];

  return (
    <button
      className={clsx(baseStyles, sizeStyles, variantStyles, className)}
      disabled={disabled}
      {...props}
    >
      {iconLeading && (
        <span className="material-symbols-outlined text-[16px] shrink-0 leading-none">
          {iconLeading}
        </span>
      )}
      {children && <span>{children}</span>}
      {iconTrailing && (
        <span className="material-symbols-outlined text-[16px] shrink-0 leading-none">
          {iconTrailing}
        </span>
      )}
    </button>
  );
};
