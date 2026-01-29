import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "flex items-center gap-2 px-4 py-2 rounded-full font-serif transition-all duration-300 transform active:scale-95 shadow-sm";
  
  const variants = {
    primary: "bg-ghibli-green text-white hover:bg-ghibli-darkGreen hover:shadow-md",
    secondary: "bg-ghibli-cream text-ghibli-wood border border-ghibli-earth/30 hover:bg-white hover:border-ghibli-earth",
    danger: "bg-red-400 text-white hover:bg-red-500",
    ghost: "bg-transparent text-ghibli-wood hover:bg-black/5 shadow-none",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`} 
      {...props}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
    </button>
  );
};
