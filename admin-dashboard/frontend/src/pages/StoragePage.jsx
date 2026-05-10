import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { StatCard } from '../components/DataDisplay';
import { userAPI } from '../services/api';
import { formatBytes } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function StoragePage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUserStorageData();
  }, []);

  const fetchUserStorageData = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getAllUsers(1000, 0);
      setUsers(response.data?.data || []);
    } catch (error) {
      toast.error('Failed to load storage data');
    } finally {
      setLoading(false);
    }
  };

  const topStorageUsers = [...users]
    .sort((a, b) => b.storage_used - a.storage_used)
    .slice(0, 10);

  const totalStorage = users.reduce((sum, user) => sum + user.storage_used, 0);
  const totalLimit = users.reduce((sum, user) => sum + user.storage_limit, 0);
  const usagePercentage = totalLimit > 0 ? (totalStorage / totalLimit) * 100 : 0;

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Storage Management</h1>
        <p className="text-gray-600 mt-2">Monitor and manage user storage allocation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Storage Used"
          value={formatBytes(totalStorage)}
          icon="💾"
          color="blue"
        />
        <StatCard
          title="Total Storage Limit"
          value={formatBytes(totalLimit)}
          icon="📊"
          color="green"
        />
        <StatCard
          title="Overall Usage"
          value={`${usagePercentage.toFixed(2)}%`}
          icon="📈"
          color="yellow"
        />
      </div>

      {/* Top Storage Users */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Top 10 Storage Users</h2>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : topStorageUsers.length > 0 ? (
          <div className="space-y-4">
            {topStorageUsers.map((user, idx) => {
              const percentage = (user.storage_used / user.storage_limit) * 100;
              return (
                <div key={user.id} className="border-b pb-4 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">{idx + 1}. {user.email}</p>
                      <p className="text-sm text-gray-600">
                        {formatBytes(user.storage_used)} / {formatBytes(user.storage_limit)}
                      </p>
                    </div>
                    <span className={`font-bold ${
                      percentage >= 90 ? 'text-red-600' :
                      percentage >= 70 ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        percentage >= 90 ? 'bg-red-600' :
                        percentage >= 70 ? 'bg-yellow-600' :
                        'bg-green-600'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No users found</p>
        )}
      </div>
    </Layout>
  );
}
