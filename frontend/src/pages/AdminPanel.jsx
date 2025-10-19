import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';

export default function AdminPanel() {
  const { theme } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/auth/users');
      // Backend shape: { success, count, data: { users: [...] } }
      const list = response?.data?.data?.users;
      setUsers(Array.isArray(list) ? list : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.patch(`/api/auth/users/${userId}/role`, { role: newRole });
      setSuccessMessage('User role updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchUsers(); // Refresh user list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update role');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    try {
      await axios.delete(`/api/auth/users/${userId}`);
      setSuccessMessage('User deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchUsers(); // Refresh user list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getRoleBadge = (role) => {
    if (role === 'admin') {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.bg} p-8`}>
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className={`h-8 ${theme.card} rounded w-1/4 mb-8`}></div>
            <div className={`${theme.card} rounded-xl p-6 space-y-4`}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={`h-16 ${theme.border} rounded`}></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} p-8`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${theme.text} mb-2`}>Admin Panel</h1>
          <p className={`${theme.textMuted}`}>Manage users and their roles</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Users Table */}
        <div className={`${theme.card} rounded-xl ${theme.shadow} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={`${theme.nav}`}>
                <tr>
                  <th className={`px-6 py-4 text-left text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>
                    User
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>
                    Email
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>
                    Role
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>
                    Status
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>
                    Last Login
                  </th>
                  <th className={`px-6 py-4 text-right text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme.border}`}>
                {users.map((user) => (
                  <tr key={user._id} className={`hover:${theme.nav} transition-colors`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white font-semibold`}>
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className={`text-sm font-medium ${theme.text}`}>{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme.textMuted}`}>
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user._id, e.target.value)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadge(user.role)} border-0 focus:ring-2 focus:ring-blue-500 cursor-pointer`}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isActive ? (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          Active
                        </span>
                      ) : (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme.textMuted}`}>
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDeleteUser(user._id, user.username)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        title="Delete user"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {users.length === 0 && (
            <div className="text-center py-12">
              <svg className={`mx-auto h-12 w-12 ${theme.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className={`mt-4 ${theme.textMuted}`}>No users found</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className={`${theme.card} rounded-xl p-6 ${theme.shadow}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme.textMuted}`}>Total Users</p>
                <p className={`text-3xl font-bold ${theme.text} mt-1`}>{users.length}</p>
              </div>
              <div className={`w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center`}>
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className={`${theme.card} rounded-xl p-6 ${theme.shadow}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme.textMuted}`}>Admins</p>
                <p className={`text-3xl font-bold ${theme.text} mt-1`}>
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
              <div className={`w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center`}>
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
          </div>

          <div className={`${theme.card} rounded-xl p-6 ${theme.shadow}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${theme.textMuted}`}>Active Users</p>
                <p className={`text-3xl font-bold ${theme.text} mt-1`}>
                  {users.filter(u => u.isActive).length}
                </p>
              </div>
              <div className={`w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center`}>
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
