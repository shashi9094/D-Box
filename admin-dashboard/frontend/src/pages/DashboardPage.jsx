import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { StatCard } from '../components/DataDisplay';
import { analyticsAPI } from '../services/api';
import { formatBytes } from '../utils/helpers';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await analyticsAPI.getStats();
      setStats(response.data?.data);
    } catch (error) {
      toast.error('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to D-Box Admin Panel</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={stats?.overview?.totalUsers || 0}
          icon="👥"
          color="blue"
          trend={5}
        />
        <StatCard
          title="Active Users"
          value={stats?.overview?.activeUsers || 0}
          icon="✅"
          color="green"
          trend={3}
        />
        <StatCard
          title="Total Files"
          value={stats?.overview?.totalFiles || 0}
          icon="📁"
          color="yellow"
          trend={12}
        />
        <StatCard
          title="Storage Used"
          value={formatBytes(stats?.overview?.totalStorageUsed || 0)}
          icon="💾"
          color="red"
          trend={8}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Daily Activity</h2>
          {stats?.dailyActivity && stats.dailyActivity.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="activity_count" stroke="#3B82F6" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No activity data available
            </div>
          )}
        </div>

        {/* Action Distribution Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Action Distribution</h2>
          {stats?.actionStats && stats.actionStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.actionStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="action" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No action data available
            </div>
          )}
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600 text-sm">Average Storage Per User</p>
          <p className="text-2xl font-bold text-gray-800 mt-2">
            {formatBytes(stats?.overview?.avgStoragePerUser || 0)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600 text-sm">Total Storage Limit</p>
          <p className="text-2xl font-bold text-gray-800 mt-2">
            {formatBytes((stats?.overview?.totalUsers || 0) * 10737418240)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600 text-sm">Storage Utilization</p>
          <p className="text-2xl font-bold text-gray-800 mt-2">
            {(
              ((stats?.overview?.totalStorageUsed || 0) / ((stats?.overview?.totalUsers || 0) * 10737418240)) *
              100
            ).toFixed(2)}
            %
          </p>
        </div>
      </div>
    </Layout>
  );
}
