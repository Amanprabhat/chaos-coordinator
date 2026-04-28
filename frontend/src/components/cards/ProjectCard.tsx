import React from 'react';
import { motion } from 'framer-motion';

interface ProjectCardProps {
  projectName: string;
  client: string;
  status: 'pending' | 'active' | 'rejected';
  assignedMembers: string[];
  onClick?: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  projectName,
  client,
  status,
  assignedMembers,
  onClick
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning bg-opacity-10 text-warning';
      case 'active':
        return 'bg-success bg-opacity-10 text-success';
      case 'rejected':
        return 'bg-danger bg-opacity-10 text-danger';
      default:
        return 'bg-textSecondary bg-opacity-10 text-textSecondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'active':
        return 'Active';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-surface border border-border rounded-lg p-4 shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-textPrimary mb-1">
            {projectName}
          </h3>
          <p className="text-sm text-textSecondary">
            {client}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(status)}`}>
          {getStatusText(status)}
        </span>
      </div>
      
      {assignedMembers.length > 0 && (
        <div className="flex items-center space-x-2">
          <span className="text-xs text-textTertiary">Team:</span>
          <div className="flex -space-x-2">
            {assignedMembers.slice(0, 3).map((member, index) => (
              <div
                key={index}
                className="w-6 h-6 rounded-full bg-background border-2 border-surface flex items-center justify-center"
                title={member}
              >
                <span className="text-xs font-medium text-textPrimary">
                  {member.charAt(0).toUpperCase()}
                </span>
              </div>
            ))}
            {assignedMembers.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-background border-2 border-surface flex items-center justify-center">
                <span className="text-xs font-medium text-textTertiary">
                  +{assignedMembers.length - 3}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ProjectCard;
