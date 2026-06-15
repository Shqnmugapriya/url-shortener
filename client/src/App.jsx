import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { api } from './utils/api';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AnalyticsView from './components/AnalyticsView';

// Toast Notification Component
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center p-4 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 ${
      type === 'success' ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200' :
      type === 'error' ? 'bg-rose-950/80 border-rose-500/30 text-rose-200' :
      'bg-indigo-950/80 border-indigo-500/30 text-indigo-200'
    }`}>
      <div className="mr-3 text-lg">
        {type === 'success' ? '✅' : type === 'error' ? '❌' : '🔔'}
      </div>
      <div className="text-sm font-medium">{message}</div>
      <button onClick={onClose} className="ml-4 text-slate-400 hover:text-slate-200 transition-colors">
        ✕
      </button>
    </div>
  );
}

// Password Unlock Screen for Protected Links
function PasswordUnlock({ shortCode, onUnlockSuccess }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.urls.verifyPassword(shortCode, password);
      // Success - Redirect user to destination
      window.location.href = data.originalUrl;
    } catch (err) {
      setError(err.message || 'Incorrect password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass max-w-md w-full p-8 rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
        <div className="text-center mb-6">
          <span className="text-4xl">🔒</span>
          <h2 className="text-2xl font-bold mt-3">Protected Link</h2>
          <p className="text-slate-400 text-sm mt-1">This shortened link is password protected. Enter the password to access the destination URL.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter link password"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200"
              required
            />
          </div>
          {error && <div className="text-xs text-rose-400 font-medium">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
          >
            {loading ? 'Verifying...' : 'Unlock Link'}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [currentView, setCurrentView] = useState('landing'); // landing, login, signup, dashboard, admin, analytics, unlock
  const [selectedUrlId, setSelectedUrlId] = useState(null);
  const [unlockShortCode, setUnlockShortCode] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [socket, setSocket] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Reference for updating components
  const socketRef = useRef(null);

  // Initialize view from URL if user is visiting unlock page
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/unlock/')) {
      const parts = path.split('/');
      const code = parts[parts.length - 1];
      if (code) {
        setUnlockShortCode(code);
        setCurrentView('unlock');
      }
    }
  }, []);

  // Fetch current user details on load
  useEffect(() => {
    const initUser = async () => {
      if (token) {
        try {
          const profile = await api.auth.getMe();
          setUser(profile);
          // Redirect based on role
          setCurrentView(profile.role === 'admin' ? 'admin' : 'dashboard');
        } catch (err) {
          console.error('Failed to fetch profile', err);
          handleLogout();
        }
      }
      setLoadingMe(false);
    };
    initUser();
  }, [token]);

  // Setup Socket.io connection when user is logged in
  useEffect(() => {
    if (user) {
      const socketConnection = io('http://localhost:5000');
      socketRef.current = socketConnection;
      setSocket(socketConnection);

      // Join room
      socketConnection.emit('join_user_room', { userId: user.id });

      // Fetch user notifications
      api.notifications.getNotifications()
        .then(data => setNotifications(data))
        .catch(err => console.error(err));

      // Listen for click events
      socketConnection.on('new_click', (data) => {
        addToast(`Someone clicked your link: shortly.com/${data.shortCode}!`, 'info');
      });

      // Listen for notifications
      socketConnection.on('new_notification', (data) => {
        setNotifications(prev => [data, ...prev]);
        addToast(data.message, data.type === 'milestone' ? 'success' : 'info');
      });

      return () => {
        socketConnection.disconnect();
        setSocket(null);
        socketRef.current = null;
      };
    }
  }, [user]);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleLoginSuccess = (token, user) => {
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    addToast(`Welcome back, ${user.name}!`, 'success');
    setCurrentView(user.role === 'admin' ? 'admin' : 'dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setCurrentView('landing');
    if (socket) {
      socket.disconnect();
    }
  };

  // Render loading state
  if (loadingMe) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-3 text-slate-400 font-medium">Initializing Shortly...</p>
        </div>
      </div>
    );
  }

  // Handle password unlock view
  if (currentView === 'unlock') {
    return <PasswordUnlock shortCode={unlockShortCode} />;
  }

  // Handle 404 Page View (Screen #14)
  if (currentView === '404') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass max-w-md w-full p-8 rounded-2xl shadow-2xl relative overflow-hidden text-center space-y-6">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500"></div>
          <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-500 tracking-wider">
            404
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-200">Page Not Found</h2>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              The page you are looking for doesn't exist or has been moved.
            </p>
          </div>
          <button
            onClick={() => setCurrentView(token ? (user?.role === 'admin' ? 'admin' : 'dashboard') : 'landing')}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-sm"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Dynamic Views */}
      {currentView === 'landing' && (
        <LandingPage 
          onNavigate={(view) => setCurrentView(view)} 
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {(currentView === 'dashboard' || currentView === 'admin' || currentView === 'analytics') && (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="glass sticky top-0 z-40 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
            <div 
              onClick={() => setCurrentView(user.role === 'admin' ? 'admin' : 'dashboard')} 
              className="flex items-center space-x-2 cursor-pointer"
            >
              <span className="text-2xl">🔗</span>
              <span className="font-extrabold text-xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">Linkify</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 font-bold uppercase tracking-wider">
                {user.role}
              </span>
            </div>

            <div className="flex items-center space-x-4">
              {/* Dashboard Return Button */}
              {currentView === 'analytics' && (
                <button 
                  onClick={() => setCurrentView(user.role === 'admin' ? 'admin' : 'dashboard')}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  ← Back to Dashboard
                </button>
              )}

              {/* User profile dropdown and log out */}
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-slate-200">{user.name}</div>
                  <div className="text-xs text-slate-400">{user.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-bold rounded-xl bg-rose-950/40 border border-rose-900/30 hover:bg-rose-900/30 hover:border-rose-500/30 text-rose-300 transition-all"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
            {currentView === 'dashboard' && (
              <Dashboard 
                user={user} 
                setUser={setUser}
                addToast={addToast} 
                onViewAnalytics={(urlId) => {
                  setSelectedUrlId(urlId);
                  setCurrentView('analytics');
                }} 
                socket={socket}
                notifications={notifications}
                setNotifications={setNotifications}
                onLogout={handleLogout}
                theme={theme}
                setTheme={setTheme}
              />
            )}

            {currentView === 'admin' && (
              <AdminDashboard 
                user={user} 
                setUser={setUser}
                addToast={addToast} 
                onViewAnalytics={(urlId) => {
                  setSelectedUrlId(urlId);
                  setCurrentView('analytics');
                }}
                onLogout={handleLogout}
                theme={theme}
                setTheme={setTheme}
              />
            )}

            {currentView === 'analytics' && (
              <AnalyticsView 
                urlId={selectedUrlId} 
                addToast={addToast} 
                socket={socket}
              />
            )}
          </main>
        </div>
      )}

      {/* Floating Toasts */}
      <div className="fixed bottom-0 right-0 p-4 space-y-2 z-50 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast 
              message={toast.message} 
              type={toast.type} 
              onClose={() => removeToast(toast.id)} 
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
