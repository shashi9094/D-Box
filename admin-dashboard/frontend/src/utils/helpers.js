export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateTime = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const getInitials = (name) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const truncateText = (text, length = 50) => {
  return text.length > length ? `${text.slice(0, length)}...` : text;
};

export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const generateRandomColor = () => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
  return colors[Math.floor(Math.random() * colors.length)];
};

export const calculateStoragePercentage = (used, limit) => {
  return Math.min((used / limit) * 100, 100);
};

export const getStorageStatus = (used, limit) => {
  const percentage = calculateStoragePercentage(used, limit);
  if (percentage >= 90) return 'critical';
  if (percentage >= 70) return 'warning';
  return 'good';
};

export const getStatusColor = (status) => {
  const colors = {
    good: 'text-green-600',
    warning: 'text-yellow-600',
    critical: 'text-red-600',
  };
  return colors[status] || 'text-gray-600';
};

export const getStatusBgColor = (status) => {
  const colors = {
    good: 'bg-green-100',
    warning: 'bg-yellow-100',
    critical: 'bg-red-100',
  };
  return colors[status] || 'bg-gray-100';
};
