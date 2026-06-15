import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { api } from '../utils/api';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

const CHART_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#10b981', '#3b82f6'];

export default function AdminDashboard({ user, setUser, addToast, onViewAnalytics, onLogout, theme, setTheme }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); // home, users, links, create, settings
  const [search, setSearch] = useState('');
  const [allUrls, setAllUrls] = useState([]);
  const [loadingUrls, setLoadingUrls] = useState(true);

  // Link Creation State (Admin can create links too)
  const [originalUrl, setOriginalUrl] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);
  const [inlineQrUrl, setInlineQrUrl] = useState('');

  // CSV Bulk Shorten State
  const [createMode, setCreateMode] = useState('single'); // single or bulk
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Settings State
  const [settingsTab, setSettingsTab] = useState('profile'); // profile, security, preferences
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    country: user?.country || 'India',
    password: '',
    confirmPassword: ''
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);

  useEffect(() => {
    fetchAdminData();
    fetchAllSystemUrls();
  }, []);

  const fetchAdminData = async () => {
    try {
      const stats = await api.analytics.getGlobalAnalytics();
      setData(stats);
    } catch (err) {
      addToast(err.message || 'Failed to load system metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSystemUrls = async () => {
    try {
      // Since user is admin, getUrls returns all system URLs
      const urls = await api.urls.getUrls();
      setAllUrls(urls);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUrls(false);
    }
  };

  const handleDeleteUrl = async (id) => {
    if (confirm('Are you sure you want to delete this URL as an administrator?')) {
      try {
        await api.urls.delete(id);
        addToast('URL deleted successfully', 'success');
        setAllUrls(prev => prev.filter(u => u.id !== id));
        // Refresh metrics
        fetchAdminData();
      } catch (err) {
        addToast(err.message || 'Failed to delete URL', 'error');
      }
    }
  };

  const handleCopy = (shortCode) => {
    const link = `http://localhost:5000/${shortCode}`;
    navigator.clipboard.writeText(link);
    addToast('Link copied to clipboard!', 'success');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!originalUrl) return;

    setCreating(true);
    setInlineQrUrl('');
    try {
      const newUrl = await api.urls.create({
        originalUrl,
        password: linkPassword || undefined
      });

      addToast('Short link generated successfully!', 'success');
      setCreatedResult(newUrl);

      // Generate inline QR Code immediately
      const shortLink = `http://localhost:5000/${newUrl.short_code}`;
      const qrDataUrl = await QRCode.toDataURL(shortLink, {
        width: 300,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
      setInlineQrUrl(qrDataUrl);
      
      // Clear form
      setOriginalUrl('');
      setLinkPassword('');

      // Refresh data
      fetchAllSystemUrls();
      fetchAdminData();
    } catch (err) {
      addToast(err.message || 'Failed to create link', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleCsvChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file);
    setBulkResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = parseCSV(text);
      setCsvData(parsed);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text) => {
    const lines = text.split('\n');
    if (lines.length === 0) return [];
    
    // Header clean
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const items = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      
      const originalUrl = obj.originalUrl || obj.original_url || values[0] || '';
      if (originalUrl) {
        items.push({
          originalUrl,
          password: obj.password || values[1] || ''
        });
      }
    }
    return items;
  };

  const handleBulkShorten = async () => {
    if (csvData.length === 0) return;
    setBulkLoading(true);
    try {
      const response = await api.urls.bulkCreate(csvData);
      
      const combined = [
        ...(response.urls || []).map(u => ({ original_url: u.original_url, short_code: u.short_code })),
        ...(response.errors || []).map(e => ({ original_url: e.originalUrl || 'Row ' + e.row, message: e.message }))
      ];
      
      setBulkResults(combined);
      addToast(`Bulk shortened ${response.count || response.urls?.length || 0} URLs successfully!`, 'success');
      
      // Clear CSV file state
      setCsvFile(null);
      setCsvData([]);
      
      // Refresh URL lists & metrics
      fetchAllSystemUrls();
      fetchAdminData();
    } catch (err) {
      addToast(err.message || 'Failed to process bulk shortening', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);

    try {
      if (settingsTab === 'profile') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(profileForm.email)) {
          throw new Error('Please provide a valid email address');
        }
      }

      if (settingsTab === 'security') {
        if (!profileForm.password) {
          throw new Error('Please enter a new password');
        }
        if (profileForm.password !== profileForm.confirmPassword) {
          throw new Error('Passwords do not match');
        }
      }

      const updated = await api.auth.updateProfile(
        profileForm.name,
        profileForm.email,
        settingsTab === 'security' ? profileForm.password : undefined,
        profileForm.country
      );

      setUser(updated);
      addToast('Profile updated successfully!', 'success');
      setProfileForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err) {
      addToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setUpdatingProfile(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-xs">Loading administration panel...</div>;
  }

  const { summary, users, charts } = data;

  const mostUsedUrl = allUrls.length > 0
    ? [...allUrls].sort((a, b) => (b.total_clicks || 0) - (a.total_clicks || 0))[0]
    : null;

  const filteredUsers = users.filter(u => 
    (u.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredUrls = allUrls.filter(u => {
    const fullShortLink = `shortly.com/${u.short_code || ''}`;
    const fullLocalLink = `http://localhost:5000/${u.short_code || ''}`;
    return (u.original_url || '').toLowerCase().includes(search.toLowerCase()) || 
           (u.short_code || '').toLowerCase().includes(search.toLowerCase()) ||
           fullShortLink.toLowerCase().includes(search.toLowerCase()) ||
           fullLocalLink.toLowerCase().includes(search.toLowerCase()) ||
           (u.owner_name && u.owner_name.toLowerCase().includes(search.toLowerCase())) ||
           (u.owner_email && u.owner_email.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-120px)] gap-6">
      
      {/* 1. Left Navigation Sidebar Panel (aligned with user sidebar style) */}
      <aside className="w-full md:w-60 glass rounded-2xl p-4 flex flex-col justify-between border border-slate-800">
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-3 mb-4">Admin Navigation</div>
          
          <button
            onClick={() => setActiveTab('home')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'home' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <span>🏠</span>
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => { setActiveTab('users'); setSearch(''); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <span>👥</span>
            <span>System Users</span>
          </button>

          <button
            onClick={() => { setActiveTab('links'); setSearch(''); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'links' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <span>🔗</span>
            <span>System Links</span>
          </button>

          <button
            onClick={() => { setActiveTab('create'); setCreatedResult(null); }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'create' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <span>✂️</span>
            <span>Create Short URL</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <span>⚙️</span>
            <span>Settings</span>
          </button>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition-all border border-transparent hover:border-rose-900/30 mt-6"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </aside>

      {/* 2. Main Content Frame */}
      <div className="flex-1 space-y-6">
        
        {/* subview: ADMIN DASHBOARD HOME */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">System Administration</h2>
              <p className="text-slate-400 text-sm">Welcome back, {user?.name} 👋. Monitor system metrics and track global analytics.</p>
            </div>

            {/* Metrics card block */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass p-5 rounded-2xl relative overflow-hidden">
                <span className="text-3xl absolute right-4 bottom-4 opacity-10">👥</span>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Active Users</div>
                <div className="text-2xl font-black mt-2 text-white">{summary.totalUsers}</div>
              </div>
              <div className="glass p-5 rounded-2xl relative overflow-hidden">
                <span className="text-3xl absolute right-4 bottom-4 opacity-10">🔗</span>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total System Links</div>
                <div className="text-2xl font-black mt-2 text-indigo-400">{summary.totalUrls}</div>
              </div>
              <div className="glass p-5 rounded-2xl relative overflow-hidden">
                <span className="text-3xl absolute right-4 bottom-4 opacity-10">⚡</span>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Global Clicks</div>
                <div className="text-2xl font-black mt-2 text-emerald-400">{summary.totalClicks}</div>
              </div>
              <div className="glass p-5 rounded-2xl relative overflow-hidden">
                <span className="text-3xl absolute right-4 bottom-4 opacity-10">⚠️</span>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Broken Links</div>
                <div className="text-2xl font-black mt-2 text-rose-400">{summary.brokenUrls}</div>
              </div>
            </div>

            {/* Most Used URL Analytics Section */}
            {mostUsedUrl && (
              <div className="glass p-6 rounded-2xl border border-indigo-500/20 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded">
                      🔥 Most Used URL
                    </span>
                    <h4 className="text-lg font-black text-white mt-2 truncate max-w-lg">
                      {mostUsedUrl.original_url}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Created by: <span className="font-bold text-slate-300">{mostUsedUrl.owner_name}</span> ({mostUsedUrl.owner_email})
                    </p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Redirect Clicks</div>
                    <div className="text-3xl font-black text-indigo-300 mt-1">{mostUsedUrl.total_clicks || 0}</div>
                    <div className="flex items-center space-x-2 mt-2 justify-start sm:justify-end">
                      <a
                        href={`http://localhost:5000/${mostUsedUrl.short_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline inline-flex items-center gap-0.5"
                      >
                        shortly.com/{mostUsedUrl.short_code} ↗
                      </a>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(mostUsedUrl.short_code)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-300 hover:underline"
                      >
                        Copy
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => onViewAnalytics(mostUsedUrl.id)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-300 hover:underline"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Global click trend chart */}
            {charts && charts.clickTrend && charts.clickTrend.length > 0 && (
              <div className="glass p-5 rounded-2xl space-y-4">
                <h3 className="font-extrabold text-base text-slate-200">Global Click Trends (Last 30 Days)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts.clickTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        labelStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                      />
                      <Line type="monotone" dataKey="clicks" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top Links Click Comparison */}
            <div className="glass p-5 rounded-2xl space-y-4">
              <h3 className="font-extrabold text-base text-slate-200">Top System Links Click Comparison</h3>
              <div className="h-64">
                {allUrls.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs">No links recorded in the system yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...allUrls].sort((a, b) => (b.total_clicks || 0) - (a.total_clicks || 0)).slice(0, 5).map(u => ({ name: `shortly.com/${u.short_code}`, clicks: u.total_clicks || 0 }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={9} tickLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        labelStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="clicks" radius={[4, 4, 0, 0]}>
                        {[...allUrls].sort((a, b) => (b.total_clicks || 0) - (a.total_clicks || 0)).slice(0, 5).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {/* subview: SYSTEM USERS */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight">System Users</h2>
                <p className="text-slate-400 text-sm">Manage users registered on the platform and track their usage statistics.</p>
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users by name/email..."
                className="w-full sm:w-80 px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-xs text-slate-200"
              />
            </div>

            <div className="glass rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider bg-slate-900/10">
                      <th className="p-4">User Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Registered Date</th>
                      <th className="p-4">Short URLs</th>
                      <th className="p-4">Total Redirect Clicks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-500">No users found.</td>
                      </tr>
                    ) : (
                      filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-900/10 transition-colors">
                          <td className="p-4 font-bold text-slate-200">{u.name}</td>
                          <td className="p-4 text-slate-400">{u.email}</td>
                          <td className="p-4 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                          <td className="p-4 font-semibold">
                            <button
                              type="button"
                              onClick={() => { setActiveTab('links'); setSearch(u.email); }}
                              className="text-indigo-400 hover:text-indigo-300 hover:underline font-bold text-left"
                            >
                              {u.total_urls} URLs
                            </button>
                          </td>
                          <td className="p-4 font-extrabold text-slate-200">{u.total_clicks} clicks</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* subview: SYSTEM LINKS */}
        {activeTab === 'links' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight">System Links</h2>
                <p className="text-slate-400 text-sm">Review, copy, inspect analytics, or delete platform-wide link redirections.</p>
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search links by destination/alias/owner..."
                className="w-full sm:w-80 px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-xs text-slate-200"
              />
            </div>

            <div className="glass rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                {loadingUrls ? (
                  <div className="p-12 text-center text-slate-500">Loading system links...</div>
                ) : (
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider bg-slate-900/10">
                        <th className="p-4">Short Link</th>
                        <th className="p-4">Owner</th>
                        <th className="p-4">Destination</th>
                        <th className="p-4">Clicks</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredUrls.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-slate-500">No links found.</td>
                        </tr>
                      ) : (
                        filteredUrls.map(url => (
                          <tr key={url.id} className="hover:bg-slate-900/10 transition-colors">
                            <td className="p-4 font-bold">
                              <a
                                href={`http://localhost:5000/${url.short_code}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-400 hover:text-indigo-300 hover:underline inline-flex items-center gap-0.5"
                              >
                                shortly.com/{url.short_code}
                                <span className="text-[10px] opacity-60">↗</span>
                              </a>
                            </td>
                            <td className="p-4">
                              <div className="font-semibold text-slate-200">{url.owner_name}</div>
                              <div className="text-[10px] text-slate-500">{url.owner_email}</div>
                            </td>
                            <td className="p-4 text-slate-400 max-w-xs truncate">{url.original_url}</td>
                            <td className="p-4 font-extrabold text-slate-200">{url.total_clicks}</td>
                            <td className="p-4">
                              {url.health_status === 'broken' ? (
                                <span className="px-2 py-0.5 rounded bg-rose-950/40 border border-rose-900/30 text-rose-400 text-[10px] font-bold uppercase">Broken</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-black uppercase">Active</span>
                              )}
                            </td>
                            <td className="p-4 text-right space-x-2 text-nowrap">
                              <button
                                onClick={() => handleCopy(url.short_code)}
                                className="px-2 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold rounded"
                              >
                                Copy
                              </button>
                              <button
                                onClick={() => onViewAnalytics(url.id)}
                                className="px-2 py-1 bg-indigo-950 border border-indigo-900/60 hover:bg-indigo-900/60 text-indigo-200 font-bold rounded"
                              >
                                Inspect
                              </button>
                              <button
                                onClick={() => handleDeleteUrl(url.id)}
                                className="px-2 py-1 bg-rose-950/40 border border-rose-900/30 hover:bg-rose-900/30 text-rose-300 font-bold rounded"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* subview: CREATE SHORT URL PAGE (Admin can also shorten URLs!) */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">Create Short URL</h2>
              <p className="text-slate-400 text-sm font-medium">Shorten your target links individually or process them in bulk.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="glass p-6 rounded-2xl lg:col-span-2 space-y-6">
                {/* Mode Switcher */}
                <div className="flex border-b border-slate-800 pb-1 gap-4">
                  <button
                    type="button"
                    onClick={() => { setCreateMode('single'); setCreatedResult(null); }}
                    className={`pb-2 text-xs font-bold transition-all relative ${
                      createMode === 'single' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🔗 Single URL
                    {createMode === 'single' && (
                      <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-full"></span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreateMode('bulk'); setBulkResults(null); }}
                    className={`pb-2 text-xs font-bold transition-all relative ${
                      createMode === 'bulk' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    📁 Bulk Shorten (CSV)
                    {createMode === 'bulk' && (
                      <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-full"></span>
                    )}
                  </button>
                </div>

                {createMode === 'single' ? (
                  <form onSubmit={handleCreate} className="space-y-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Enter your long URL</label>
                      <input
                        type="url"
                        value={originalUrl}
                        onChange={(e) => setOriginalUrl(e.target.value)}
                        placeholder="https://example.com/long-url-path"
                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Link Password (Optional)</label>
                      <input
                        type="password"
                        value={linkPassword}
                        onChange={(e) => setLinkPassword(e.target.value)}
                        placeholder="Password lock for protection"
                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={creating}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-sm"
                    >
                      {creating ? 'Shortening...' : 'Shorten URL'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="border border-dashed border-slate-800 p-6 rounded-2xl text-center space-y-4">
                      <div className="text-3xl">📥</div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-200">Upload CSV File</h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Your CSV should have headers: <code className="text-indigo-400 font-mono">originalUrl</code>, <code className="text-slate-400 font-mono">password</code> (optional).
                        </p>
                      </div>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleCsvChange}
                        className="hidden"
                        id="csv-upload"
                      />
                      <label
                        htmlFor="csv-upload"
                        className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/15"
                      >
                        Choose CSV File
                      </label>
                      {csvFile && (
                        <div className="text-xs text-slate-300 font-semibold mt-2">
                          Selected: {csvFile.name} ({csvData.length} records parsed)
                        </div>
                      )}
                    </div>

                    {csvData.length > 0 && (
                      <button
                        onClick={handleBulkShorten}
                        disabled={bulkLoading}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-sm"
                      >
                        {bulkLoading ? 'Processing Bulk Shortening...' : `Shorten ${csvData.length} URLs`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Created URL Results Box */}
              <div className="glass p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-slate-200 mb-2">
                    {createMode === 'bulk' ? 'Bulk Results' : 'Your Short URL'}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {createMode === 'bulk'
                      ? 'Review the shortened codes and redirection matches generated from your uploaded file.'
                      : 'Once shortened, copy your customized tracking link or download the generated QR Code vector to share.'}
                  </p>
                </div>

                {createMode === 'bulk' ? (
                  bulkResults ? (
                    <div className="space-y-3 mt-4 overflow-y-auto max-h-60 pr-1">
                      {bulkResults.map((res, i) => (
                        <div key={i} className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-left space-y-1">
                          <div className="text-[10px] text-slate-500 truncate">{res.original_url}</div>
                          {res.message ? (
                            <div className="text-[10px] text-rose-400 font-semibold">{res.message}</div>
                          ) : (
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-indigo-400">shortly.com/{res.short_code}</span>
                              <button
                                onClick={() => handleCopy(res.short_code)}
                                className="text-[9px] font-bold text-slate-450 hover:text-white px-2 py-0.5 bg-slate-950 rounded border border-slate-800"
                              >
                                Copy
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-28 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500 mt-6 text-center">
                      Upload and process CSV to view bulk shortened links
                    </div>
                  )
                ) : createdResult ? (
                  <div className="space-y-4 mt-4 flex flex-col items-center">
                    <div className="w-full bg-slate-900/60 dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-500/20 text-indigo-400 font-bold text-center select-all text-sm truncate">
                      http://localhost:5000/{createdResult.short_code}
                    </div>

                    {inlineQrUrl && (
                      <div className="bg-white p-2.5 rounded-xl border border-slate-250 flex justify-center items-center shadow-md">
                        <img src={inlineQrUrl} alt="Generated QR" className="w-32 h-32" />
                      </div>
                    )}

                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => handleCopy(createdResult.short_code)}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/15"
                      >
                        Copy Link
                      </button>
                      {inlineQrUrl && (
                        <a
                          href={inlineQrUrl}
                          download={`qr_${createdResult.short_code}.png`}
                          className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/50 text-slate-350 hover:text-white text-xs font-bold rounded-xl text-center flex items-center justify-center transition-all"
                        >
                          Download QR
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-28 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500 mt-6 text-center">
                    Submit long URL to generate linkify short code
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* subview: SETTINGS (Admin can manage their profile, passwords, and themes!) */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">Settings</h2>
              <p className="text-slate-400 text-sm">Manage your administrator account details and layout preferences.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Tab menu */}
              <div className="glass rounded-2xl p-4 h-fit space-y-1">
                <button
                  type="button"
                  onClick={() => setSettingsTab('profile')}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    settingsTab === 'profile' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                  }`}
                >
                  👤 Profile Settings
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab('security')}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    settingsTab === 'security' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                  }`}
                >
                  🔒 Password & Security
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab('preferences')}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    settingsTab === 'preferences' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                  }`}
                >
                  🎨 Preferences (Theme)
                </button>
              </div>

              {/* Form card */}
              <div className="glass p-6 rounded-2xl lg:col-span-3">
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  {settingsTab === 'profile' && (
                    <div className="space-y-4">
                      {/* Avatar preview block */}
                      <div className="flex items-center space-x-4 pb-2">
                        <div className="w-16 h-16 rounded-full bg-indigo-950 border border-indigo-500/30 flex items-center justify-center font-black text-indigo-400 text-xl">
                          {user?.name ? user.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'A'}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-200">Profile Picture</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">Avatar generated dynamically from your initials.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Name</label>
                          <input
                            type="text"
                            value={profileForm.name}
                            onChange={(e) => setProfileForm(prev=>({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                          <input
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm(prev=>({ ...prev, email: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                            required
                          />
                        </div>

                        <div className="sm:col-span-2 col-span-1">
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Country</label>
                          <input
                            type="text"
                            value={profileForm.country}
                            onChange={(e) => setProfileForm(prev=>({ ...prev, country: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsTab === 'security' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">New Password</label>
                          <input
                            type="password"
                            value={profileForm.password}
                            onChange={(e) => setProfileForm(prev=>({ ...prev, password: e.target.value }))}
                            placeholder="Enter new password"
                            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Confirm New Password</label>
                          <input
                            type="password"
                            value={profileForm.confirmPassword}
                            onChange={(e) => setProfileForm(prev=>({ ...prev, confirmPassword: e.target.value }))}
                            placeholder="Confirm new password"
                            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsTab === 'preferences' && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-200 mb-1">Theme Settings</h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed mb-4">
                          Select your visual experience. Toggle between our dark mode glassmorphism or light mode high-contrast appearance.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setTheme('light')}
                          className={`p-4 rounded-xl border flex flex-col items-center justify-center space-y-2 transition-all ${
                            theme === 'light'
                              ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 shadow-md shadow-indigo-600/5'
                              : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700/50 hover:text-slate-300'
                          }`}
                        >
                          <span className="text-2xl">☀️</span>
                          <span className="text-xs font-bold">Light Mode</span>
                          <span className="text-[9px] text-slate-500 font-medium">High Contrast / Indigo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTheme('dark')}
                          className={`p-4 rounded-xl border flex flex-col items-center justify-center space-y-2 transition-all ${
                            theme === 'dark'
                              ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 shadow-md shadow-indigo-600/5'
                              : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700/50 hover:text-slate-300'
                          }`}
                        >
                          <span className="text-2xl">🌙</span>
                          <span className="text-xs font-bold">Dark Mode</span>
                          <span className="text-[9px] text-slate-500 font-medium">Sleek Neon Glassmorphism</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {(settingsTab === 'profile' || settingsTab === 'security') && (
                    <button
                      type="submit"
                      disabled={updatingProfile}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-xs"
                    >
                      {updatingProfile ? 'Updating...' : 'Update Settings'}
                    </button>
                  )}
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
