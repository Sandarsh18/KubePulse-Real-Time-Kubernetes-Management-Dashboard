import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { user, loading } = useAuth();
  const { theme } = useTheme();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.bg}`}>
        <div className="text-center">
          <div className={`mx-auto w-16 h-16 bg-gradient-to-br ${theme.gradient} rounded-2xl flex items-center justify-center ${theme.shadow} animate-pulse`}>
            <svg className="w-10 h-10 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <p className={`mt-4 text-sm ${theme.textMuted}`}>Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.bg}`}>
        <div className={`max-w-md w-full ${theme.card} rounded-xl p-8 ${theme.shadow} text-center`}>
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className={`text-2xl font-bold ${theme.text} mb-2`}>Access Denied</h2>
          <p className={`${theme.textMuted} mb-6`}>
            You don't have permission to access this page. 
            {requiredRole && ` Required role: ${requiredRole}`}
          </p>
          <button
            onClick={() => window.history.back()}
            className={`px-6 py-2 bg-gradient-to-r ${theme.gradient} text-white rounded-lg hover:opacity-90 transition-opacity`}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return children;
}
