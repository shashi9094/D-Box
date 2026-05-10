import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { StatCard } from '../components/DataDisplay';
import { analyticsAPI } from '../services/api';
import { formatBytes } from '../utils/helpers';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await analyticsAPI.getStats();
      setStats(response.data?.data);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Analytics</h1>
        <p className="text-gray-600 mt-2">Detailed system analytics and insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={stats?.overview?.totalUsers || 0}
          icon="👥"
          color="blue"
        />
        <StatCard
          title="Active Users"
          value={stats?.overview?.activeUsers || 0}
          icon="✅"
          color="green"
        />
        <StatCard
          title="Total Files"
          value={stats?.overview?.totalFiles || 0}
          icon="📁"
          color="yellow"
        />
        <StatCard
          title="Storage Used"
          value={formatBytes(stats?.overview?.totalStorageUsed || 0)}
          icon="💾"
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Activity */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Daily Activity (Last 30 Days)</h2>
          {stats?.dailyActivity && stats.dailyActivity.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="activity_count" stroke="#3B82F6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* Action Distribution */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Action Distribution</h2>
          {stats?.actionStats && stats.actionStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.actionStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ action, count }) => `${action}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {stats.actionStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Key Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-gray-600 text-sm">Average Storage Per User</p>
            <p className="text-2xl font-bold text-gray-800 mt-2">
              {formatBytes(stats?.overview?.avgStoragePerUser || 0)}
            </p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Active User Rate</p>
            <p className="text-2xl font-bold text-gray-800 mt-2">
              {stats?.overview?.totalUsers
                ? ((stats.overview.activeUsers / stats.overview.totalUsers) * 100).toFixed(1)
                : 0}
              %
            </p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Storage Utilization</p>
            <p className="text-2xl font-bold text-gray-800 mt-2">
              {stats?.overview?.totalUsers
                ? (
                    ((stats.overview.totalStorageUsed || 0) /
                      (stats.overview.totalUsers * 10737418240)) *
                    100
                  ).toFixed(2)
                : 0}
              %
            </p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Files Per User</p>
            <p className="text-2xl font-bold text-gray-800 mt-2">
              {stats?.overview?.totalUsers
                ? (stats.overview.totalFiles / stats.overview.totalUsers).toFixed(2)
                : 0}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
