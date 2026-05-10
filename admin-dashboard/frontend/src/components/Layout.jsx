import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, Search, Bell } from 'lucide-react';
import { useAuthStore } from '../context/authStore';

export const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Users', path: '/users', icon: '👥' },
    { label: 'Files', path: '/files', icon: '📁' },
    { label: 'Storage', path: '/storage', icon: '💾' },
    { label: 'Analytics', path: '/analytics', icon: '📈' },
    { label: 'Activity Logs', path: '/activity', icon: '📋' },
    { label: 'Settings', path: '/settings', icon: '⚙️' },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-blue-600 text-white p-2 rounded"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div
        className={`fixed left-0 top-0 h-screen bg-white shadow-lg transition-all duration-300 z-40 ${
          isOpen ? 'w-64' : 'w-0 lg:w-64'
        } overflow-hidden`}
      >
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-blue-600">D-Box Admin</h1>
        </div>

        <nav className="p-4">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-lg mb-2 transition ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full border-t p-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <LogOut size={20} className="mr-2" />
            Logout
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-30"
        />
      )}
    </>
  );
};

export const Header = ({ onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuthStore();

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  return (
    <header className="bg-white shadow-md border-b">
      <div className="flex items-center justify-between p-4 ml-0 lg:ml-64">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search users, files..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4">
          <button className="relative p-2 text-gray-600 hover:text-gray-800">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full" />
          </button>

          <div className="flex items-center gap-2 pl-4 border-l">
            <div>
              <p className="text-sm font-medium text-gray-800">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.role}</p>
            </div>
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
              {user?.name?.charAt(0)}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export const Layout = ({ children, onSearch }) => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 lg:ml-64">
        <Header onSearch={onSearch} />
        <main className="p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
