import { Shield } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const Logo = ({ size = 'md', showText = true }: LogoProps) => {
  const sizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };
  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  return (
    <div className="flex items-center gap-2">
      <div className="rounded-xl bg-primary p-1.5 shadow-soft">
        <Shield className={`${sizes[size]} text-primary-foreground`} />
      </div>
      {showText && (
        <span className={`font-display font-bold text-foreground ${textSizes[size]}`}>
          Guardian<span className="text-primary">Gate</span>
        </span>
      )}
    </div>
  );
};

export default Logo;
