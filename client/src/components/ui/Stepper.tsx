import React from 'react';
import { motion } from 'framer-motion';
import { tokens } from '../../theme/tokens';
import StatusBadge from './StatusBadge';

interface Step {
  id: string;
  title: string;
  description?: string;
  status?: 'pending' | 'active' | 'completed' | 'error';
  icon?: React.ReactNode;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onStepClick?: (stepIndex: number) => void;
}

const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  orientation = 'horizontal',
  size = 'md',
  className = '',
  onStepClick,
}) => {
  const getStepStyles = (index: number) => {
    const step = steps[index];
    const isActive = index === currentStep;
    const isCompleted = index < currentStep;
    const isPending = index > currentStep;

    if (step.status === 'error') {
      return {
        circle: 'bg-danger text-white border-danger',
        line: 'bg-danger',
        text: 'text-danger',
      };
    }

    if (isActive) {
      return {
        circle: 'bg-accent text-white border-accent ring-2 ring-accent/20',
        line: 'bg-accent',
        text: 'text-accent font-semibold',
      };
    }

    if (isCompleted) {
      return {
        circle: 'bg-success text-white border-success',
        line: 'bg-success',
        text: 'text-success',
      };
    }

    return {
      circle: 'bg-surface text-textTertiary border-border',
      line: 'bg-border',
      text: 'text-textTertiary',
    };
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          circle: 'w-6 h-6 text-xs',
          line: 'h-0.5',
          spacing: 'space-x-2',
        };
      case 'md':
        return {
          circle: 'w-8 h-8 text-sm',
          line: 'h-0.5',
          spacing: 'space-x-4',
        };
      case 'lg':
        return {
          circle: 'w-10 h-10 text-base',
          line: 'h-1',
          spacing: 'space-x-6',
        };
      default:
        return {
          circle: 'w-8 h-8 text-sm',
          line: 'h-0.5',
          spacing: 'space-x-4',
        };
    }
  };

  const sizeStyles = getSizeStyles();

  const renderStep = (step: Step, index: number) => {
    const styles = getStepStyles(index);
    const isActive = index === currentStep;
    const isClickable = onStepClick && index <= currentStep;

    return (
      <div
        key={step.id}
        className={`flex items-center ${orientation === 'horizontal' ? sizeStyles.spacing : 'space-y-2'}`}
      >
        {/* Step Circle */}
        <motion.div
          className={`
            flex items-center justify-center
            rounded-full border-2
            ${sizeStyles.circle}
            ${styles.circle}
            ${isClickable ? 'cursor-pointer' : ''}
          `}
          whileHover={isClickable ? { scale: 1.1 } : {}}
          whileTap={isClickable ? { scale: 0.9 } : {}}
          onClick={() => isClickable && onStepClick(index)}
        >
          {step.status === 'completed' ? (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : step.status === 'error' ? (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            step.icon || index + 1
          )}
        </motion.div>

        {/* Step Content */}
        {orientation === 'vertical' && (
          <div className="flex-1 ml-4">
            <h3 className={`text-sm font-medium ${styles.text}`}>
              {step.title}
            </h3>
            {step.description && (
              <p className="text-xs text-textSecondary mt-1">
                {step.description}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderConnector = (index: number) => {
    const styles = getStepStyles(index);
    const isCompleted = index < currentStep;

    return (
      <div
        className={`
          flex-1 ${sizeStyles.line} rounded-full
          ${isCompleted ? styles.line : 'bg-border'}
        `}
      />
    );
  };

  if (orientation === 'vertical') {
    return (
      <div className={`space-y-4 ${className}`}>
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start">
            {renderStep(step, index)}
            {index < steps.length - 1 && (
              <div className={`ml-4 mt-2 w-0.5 h-8 ${getStepStyles(index).line}`} />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          {renderStep(step, index)}
          {orientation === 'horizontal' && index < steps.length - 1 && (
            renderConnector(index)
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// Step content component for displaying step details
interface StepContentProps {
  step: Step;
  isActive: boolean;
  children: React.ReactNode;
}

export const StepContent: React.FC<StepContentProps> = ({
  step,
  isActive,
  children,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: isActive ? 1 : 0, x: isActive ? 0 : 20 }}
      transition={{ duration: 0.3 }}
      className="mt-8"
    >
      {isActive && (
        <div>
          <h3 className="text-lg font-semibold text-textPrimary mb-2">
            {step.title}
          </h3>
          {step.description && (
            <p className="text-textSecondary mb-4">
              {step.description}
            </p>
          )}
          {children}
        </div>
      )}
    </motion.div>
  );
};

export default Stepper;
