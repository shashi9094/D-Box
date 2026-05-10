import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { DataTable, Pagination } from '../components/DataDisplay';
import { activityAPI } from '../services/api';
import { formatDate } from '../utils/helpers';
import { Badge } from '../components/UI';
import toast from 'react-hot-toast';

export default function ActivityPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 50;

  useEffect(() => {
    fetchLogs();
  }, [currentPage]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * limit;
      const response = await activityAPI.getActivityLogs(limit, offset);
      setLogs(response.data?.data || []);
      setTotalPages(response.data?.pagination?.pages || 1);
    } catch (error) {
      toast.error('Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    const colors = {
      USER_BANNED: 'red',
      USER_DELETED: 'red',
      FILE_DELETED: 'red',
      ROLE_CHANGED: 'yellow',
      STORAGE_LIMIT_CHANGED: 'yellow',
      LOGIN_AS_USER: 'purple',
      SETTINGS_UPDATED: 'blue',
    };
    return colors[action] || 'gray';
  };

  const columns = [
    {
      key: 'action',
      label: 'Action',
      render: (value) => <Badge variant={getActionColor(value)}>{value}</Badge>,
    },
    {
      key: 'admin',
      label: 'Admin',
      render: (value) => value?.email || 'System',
    },
    {
      key: 'targetUserData',
      label: 'Target User',
      render: (value) => value?.email || '-',
    },
    {
      key: 'description',
      label: 'Description',
    },
    {
      key: 'created_at',
      label: 'Timestamp',
      render: (value) => formatDate(value),
    },
  ];

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Activity Logs</h1>
        <p className="text-gray-600 mt-2">Track all admin activities and system events</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <DataTable
          columns={columns}
          data={logs}
          loading={loading}
        />
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          loading={loading}
        />
      </div>
    </Layout>
  );
}
