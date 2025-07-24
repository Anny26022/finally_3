import React from "react";
import { Spinner } from "@heroui/react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullScreen?: boolean;
  className?: string;
  icon?: string;
  variant?: 'default' | 'modern' | 'minimal';
}

// High-performance loader component with GPU acceleration and modern variants
export const Loader: React.FC<LoaderProps> = React.memo(({
  size = 'md',
  message = 'Loading...',
  fullScreen = false,
  className = '',
  icon,
  variant = 'default'
}) => {
  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm gpu-accelerated'
    : 'flex flex-col items-center justify-center min-h-[200px] gpu-accelerated';

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  // Modern variant with icon support
  if (variant === 'modern') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`${containerClasses} ${className}`}
      >
        <div className="text-center space-y-4">
          <div className={`relative mx-auto ${sizeClasses[size]} ${size === 'lg' ? 'w-16 h-16' : ''}`}>
            {/* Outer ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary/20"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            {/* Inner ring */}
            <motion.div
              className="absolute inset-1 rounded-full border-2 border-transparent border-t-primary border-r-primary"
              animate={{ rotate: -360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
            {/* Center with icon */}
            {icon && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon icon={icon} className={`${iconSizeClasses[size]} text-primary`} />
              </div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <p className="text-sm font-medium text-foreground/80 mb-2">{message}</p>
            <div className="flex items-center justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 bg-primary rounded-full"
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0.4, 1, 0.4],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // Default variant
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`${containerClasses} ${className}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-4"
      >
        <div className="relative gpu-accelerated">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className={`${sizeClasses[size]} border-2 border-foreground/20 border-t-foreground rounded-full loading-spinner`}
          />
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.8, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className={`absolute inset-0 ${sizeClasses[size]} border border-foreground/10 rounded-full gpu-accelerated`}
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <p className="text-sm font-medium text-foreground/80 mb-2 font-sans optimized-text">{message}</p>
        <div className="flex items-center justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1 h-1 bg-foreground rounded-full gpu-accelerated"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.4, 1, 0.4],
                y: [0, -2, 0]
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
});

Loader.displayName = 'Loader';