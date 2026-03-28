import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  change?: number;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  isLoading?: boolean;
}

const colorClasses: Record<string, string> = {
  primary: 'bg-indigo-100 text-indigo-600',
  success: 'bg-green-100 text-green-600',
  warning: 'bg-yellow-100 text-yellow-600',
  danger: 'bg-red-100 text-red-600',
  info: 'bg-blue-100 text-blue-600',
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
  red: 'bg-red-100 text-red-600',
};

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  change,
  color = 'primary',
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-8 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && change !== undefined && (
            <p className={`text-sm mt-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {trend === 'up' ? '↑' : '↓'} {Math.abs(change)}% from last week
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color] || colorClasses.primary}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
