import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { DataTable, StatCard } from '../components/DataDisplay';
import { Button, Badge, Modal, Input } from '../components/UI';
import { userAPI, fileAPI } from '../services/api';
import { formatBytes, formatDate, calculateStoragePercentage, getStorageStatus } from '../utils/helpers';
import { ArrowLeft, Trash2, Ban, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [storageLimit, setStorageLimit] = useState('');

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getUserById(userId);
      setUser(response.data?.data);
      setFiles(response.data?.data?.files || []);
      setStorageLimit(response.data?.data?.storage_limit || '');
    } catch (error) {
      toast.error('Failed to load user details');
      navigate('/users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStorageLimit = async () => {
    try {
      await userAPI.updateStorageLimit(userId, parseInt(storageLimit));
      toast.success('Storage limit updated successfully');
      setShowModal(false);
      fetchUserDetails();
    } catch (error) {
      toast.error('Failed to update storage limit');
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (confirm('Are you sure you want to delete this file?')) {
      try {
        await fileAPI.deleteFile(fileId);
        toast.success('File deleted successfully');
        fetchUserDetails();
      } catch (error) {
        toast.error('Failed to delete file');
      }
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

  if (!user) {
    return (
      <Layout>
        <div className="text-center py-8">
          <p className="text-gray-600">User not found</p>
          <Button onClick={() => navigate('/users')} className="mt-4">
            Back to Users
          </Button>
        </div>
      </Layout>
    );
  }

  const storagePercentage = calculateStoragePercentage(user.storage_used, user.storage_limit);
  const storageStatus = getStorageStatus(user.storage_used, user.storage_limit);

  const fileColumns = [
    { key: 'file_name', label: 'File Name' },
    { key: 'file_size', label: 'Size', render: (value) => formatBytes(value) },
    { key: 'mime_type', label: 'Type' },
    { key: 'uploaded_at', label: 'Uploaded', render: (value) => formatDate(value) },
  ];

  const fileActions = (file) => (
    <button
      onClick={() => handleDeleteFile(file.id)}
      className="p-2 text-red-600 hover:bg-red-50 rounded"
    >
      <Trash2 size={18} />
    </button>
  );

  return (
    <Layout>
      <button
        onClick={() => navigate('/users')}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
      >
        <ArrowLeft size={20} />
        Back to Users
      </button>

      {/* User Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold">
              {user.name?.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{user.name}</h1>
              <p className="text-gray-600">{user.email}</p>
              <Badge
                variant={
                  user.role === 'SUPER_ADMIN' ? 'red' : user.role === 'ADMIN' ? 'blue' : 'gray'
                }
              >
                {user.role}
              </Badge>
            </div>
          </div>
          <Badge variant={user.is_banned ? 'red' : 'green'}>
            {user.is_banned ? 'Banned' : 'Active'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Username</p>
            <p className="font-semibold">{user.username}</p>
          </div>
          <div>
            <p className="text-gray-600">Created</p>
            <p className="font-semibold">{formatDate(user.created_at)}</p>
          </div>
          <div>
            <p className="text-gray-600">Last Login</p>
            <p className="font-semibold">{user.last_login ? formatDate(user.last_login) : 'Never'}</p>
          </div>
          <div>
            <p className="text-gray-600">Files</p>
            <p className="font-semibold">{files.length}</p>
          </div>
        </div>
      </div>

      {/* Storage Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Storage Usage</h3>
            <Button
              onClick={() => setShowModal(true)}
              size="sm"
              variant="secondary"
              className="gap-2"
            >
              <Edit2 size={16} />
              Edit
            </Button>
          </div>

          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">{formatBytes(user.storage_used)}</span>
              <span className="text-sm text-gray-600">{formatBytes(user.storage_limit)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  storageStatus === 'good'
                    ? 'bg-green-600'
                    : storageStatus === 'warning'
                    ? 'bg-yellow-600'
                    : 'bg-red-600'
                }`}
                style={{ width: `${storagePercentage}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-600">
            {storagePercentage.toFixed(2)}% used
          </p>
        </div>

        <StatCard title="Total Files" value={files.length} icon="📁" color="yellow" />
        <StatCard
          title="Total Size"
          value={formatBytes(user.storage_used)}
          icon="💾"
          color="blue"
        />
      </div>

      {/* Files */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">User Files</h2>
        <DataTable
          columns={fileColumns}
          data={files}
          actions={fileActions}
        />
        {files.length === 0 && (
          <p className="text-center text-gray-500 py-8">No files uploaded</p>
        )}
      </div>

      {/* Storage Limit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Update Storage Limit"
      >
        <div className="mb-4">
          <p className="text-gray-600 mb-4">Current limit: {formatBytes(user.storage_limit)}</p>
          <Input
            label="Storage Limit (Bytes)"
            type="number"
            value={storageLimit}
            onChange={(e) => setStorageLimit(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleUpdateStorageLimit} variant="primary" className="flex-1">
            Update
          </Button>
          <Button onClick={() => setShowModal(false)} variant="secondary" className="flex-1">
            Cancel
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}
