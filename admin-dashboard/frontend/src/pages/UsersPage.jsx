import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { DataTable, Pagination, StatCard } from '../components/DataDisplay';
import { Button, Badge, Modal, Input } from '../components/UI';
import { userAPI } from '../services/api';
import { formatBytes, formatDate } from '../utils/helpers';
import { Trash2, Shield, Ban, Eye, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newRole, setNewRole] = useState('USER');
  const navigate = useNavigate();

  const limit = 20;

  useEffect(() => {
    fetchUsers();
  }, [currentPage, search]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * limit;
      const response = await userAPI.getAllUsers(limit, offset, search);
      setUsers(response.data?.data || []);
      setTotalPages(response.data?.pagination?.pages || 1);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId, isBanned) => {
    try {
      if (isBanned) {
        await userAPI.unbanUser(userId);
        toast.success('User unbanned successfully');
      } else {
        await userAPI.banUser(userId);
        toast.success('User banned successfully');
      }
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleChangeRole = async () => {
    try {
      await userAPI.changeRole(selectedUser.id, newRole);
      toast.success('User role updated successfully');
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await userAPI.deleteUser(userId);
        toast.success('User deleted successfully');
        fetchUsers();
      } catch (error) {
        toast.error('Failed to delete user');
      }
    }
  };

  const handleLoginAsUser = async (userId) => {
    try {
      const response = await userAPI.loginAsUser(userId);
      localStorage.setItem('token', response.data?.token);
      toast.success('Logged in as user');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to login as user');
    }
  };

  const columns = [
    { key: 'email', label: 'Email' },
    { key: 'name', label: 'Name' },
    {
      key: 'role',
      label: 'Role',
      render: (value) => (
        <Badge variant={value === 'SUPER_ADMIN' ? 'red' : value === 'ADMIN' ? 'blue' : 'gray'}>
          {value}
        </Badge>
      ),
    },
    {
      key: 'storage_used',
      label: 'Storage Used',
      render: (value) => formatBytes(value),
    },
    {
      key: 'is_banned',
      label: 'Status',
      render: (value) => (
        <Badge variant={value ? 'red' : 'green'}>
          {value ? 'Banned' : 'Active'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (value) => formatDate(value),
    },
  ];

  const actions = (row) => (
    <div className="flex gap-2">
      <button
        onClick={() => navigate(`/users/${row.id}`)}
        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
        title="View Details"
      >
        <Eye size={18} />
      </button>
      <button
        onClick={() => {
          setSelectedUser(row);
          setNewRole(row.role);
          setShowModal(true);
        }}
        className="p-2 text-purple-600 hover:bg-purple-50 rounded"
        title="Change Role"
      >
        <Shield size={18} />
      </button>
      <button
        onClick={() => handleBanUser(row.id, row.is_banned)}
        className={`p-2 rounded ${row.is_banned ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50'}`}
        title={row.is_banned ? 'Unban' : 'Ban'}
      >
        <Ban size={18} />
      </button>
      <button
        onClick={() => handleLoginAsUser(row.id)}
        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded"
        title="Login as User"
      >
        <LogIn size={18} />
      </button>
      <button
        onClick={() => handleDeleteUser(row.id)}
        className="p-2 text-red-600 hover:bg-red-50 rounded"
        title="Delete"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );

  return (
    <Layout onSearch={setSearch}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Users Management</h1>
        <p className="text-gray-600 mt-2">Manage all users and their permissions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Users" value={users.length} icon="👥" color="blue" />
        <StatCard title="Active Users" value={users.filter(u => !u.is_banned).length} icon="✅" color="green" />
        <StatCard title="Banned Users" value={users.filter(u => u.is_banned).length} icon="🚫" color="red" />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <DataTable
          columns={columns}
          data={users}
          loading={loading}
          actions={actions}
          onRowClick={(user) => navigate(`/users/${user.id}`)}
        />
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          loading={loading}
        />
      </div>

      {/* Role Change Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Change User Role"
      >
        <div className="mb-4">
          <p className="text-gray-600 mb-4">
            User: <strong>{selectedUser?.email}</strong>
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            New Role
          </label>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleChangeRole} variant="primary" className="flex-1">
            Update Role
          </Button>
          <Button onClick={() => setShowModal(false)} variant="secondary" className="flex-1">
            Cancel
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}
