import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { DataTable, Pagination, StatCard } from '../components/DataDisplay';
import { fileAPI } from '../services/api';
import { formatBytes, formatDate } from '../utils/helpers';
import { Trash2, Download, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FilesPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 50;

  useEffect(() => {
    fetchFiles();
  }, [currentPage]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * limit;
      const response = await fileAPI.getAllFiles(limit, offset);
      setFiles(response.data?.data || []);
      setTotalPages(response.data?.pagination?.pages || 1);
    } catch (error) {
      toast.error('Failed to fetch files');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (confirm('Are you sure you want to delete this file?')) {
      try {
        await fileAPI.deleteFile(fileId);
        toast.success('File deleted successfully');
        fetchFiles();
      } catch (error) {
        toast.error('Failed to delete file');
      }
    }
  };

  const columns = [
    { key: 'file_name', label: 'File Name' },
    {
      key: 'user',
      label: 'Uploaded By',
      render: (value, row) => row.user?.email || 'Unknown',
    },
    {
      key: 'file_size',
      label: 'Size',
      render: (value) => formatBytes(value),
    },
    {
      key: 'mime_type',
      label: 'Type',
      render: (value) => value || 'Unknown',
    },
    {
      key: 'uploaded_at',
      label: 'Uploaded',
      render: (value) => formatDate(value),
    },
  ];

  const actions = (row) => (
    <div className="flex gap-2">
      <a
        href={row.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
        title="Download"
      >
        <Download size={18} />
      </a>
      <button
        onClick={() => handleDeleteFile(row.id)}
        className="p-2 text-red-600 hover:bg-red-50 rounded"
        title="Delete"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );

  const totalSize = files.reduce((sum, file) => sum + file.file_size, 0);

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Files Management</h1>
        <p className="text-gray-600 mt-2">View and manage all uploaded files</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Files" value={files.length} icon="📁" color="blue" />
        <StatCard title="Unique Uploaders" value={new Set(files.map(f => f.user_id)).size} icon="👥" color="green" />
        <StatCard title="Total Size" value={formatBytes(totalSize)} icon="💾" color="yellow" />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <DataTable
          columns={columns}
          data={files}
          loading={loading}
          actions={actions}
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
