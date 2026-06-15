import React, { useState } from 'react';
import { api } from '../utils/api';

export default function LandingPage({ onNavigate, onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // login, signup, verify-email, forgot-password, reset-password
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    newPassword: '',
    confirmPassword: '',
    isAdmin: false,
    resetToken: '',
    country: 'India'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (activeTab === 'login') {
        const data = await api.auth.login(formData.email, formData.password);
        onLoginSuccess(data.token, data.user);
      } else if (activeTab === 'signup') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          throw new Error('Please provide a valid email address');
        }
        const role = 'user';
        await api.auth.register(formData.name, formData.email, formData.password, role, formData.country);
        setActiveTab('verify-email');
      } else if (activeTab === 'forgot-password') {
        const res = await api.auth.forgotPassword(formData.email);
        setSuccessMsg(res.message);
        setGeneratedToken(res.token);
        // Prefill token for reset view
        setFormData(prev => ({ ...prev, resetToken: res.token }));
      } else if (activeTab === 'reset-password') {
        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const res = await api.auth.resetPassword(formData.resetToken, formData.newPassword);
        setSuccessMsg(res.message + '. Please login now.');
        setTimeout(() => {
          setActiveTab('login');
          setFormData(prev => ({ ...prev, password: '', newPassword: '', confirmPassword: '', resetToken: '' }));
          setSuccessMsg('');
          setGeneratedToken('');
        }, 3000);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Landing Navigation Header */}
      <header className="glass border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveTab('login')}>
          <span className="text-2xl">🔗</span>
          <span className="font-extrabold text-xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">Linkify</span>
        </div>
        <nav className="hidden md:flex items-center space-x-6 text-sm text-slate-300 font-semibold">
          <a href="#home" onClick={() => setActiveTab('login')} className="hover:text-white transition-colors">Home</a>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </nav>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setActiveTab('login')} 
            className="text-sm font-semibold text-slate-300 hover:text-white px-3 py-1.5 transition-colors"
          >
            Login
          </button>
          <button 
            onClick={() => setActiveTab('signup')} 
            className="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition-colors shadow-lg shadow-indigo-600/10"
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* Main Column Grid */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 md:p-12 max-w-7xl mx-auto w-full gap-12">
        
        {/* Left Side: Brand Marketing Panel */}
        <div className="flex-1 space-y-6 text-center md:text-left">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-950/50 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <span>✨ Modern SaaS</span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            <span>Linkify Analytics</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight text-white">
            Shorten URLs.<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400">
              Track Clicks.
            </span><br />
            Share Anywhere.
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto md:mx-0">
            Linkify is a fast and secure URL shortener with powerful analytics. Monitor click counts, geographics, devices, browser trends, and protect links with passwords and expiry dates.
          </p>

          <button 
            onClick={() => setActiveTab('signup')}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-sm"
          >
            Get Started Free
          </button>

          {/* Core Feature Highlights cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-left">
            <div className="glass p-4 rounded-xl border border-slate-800 hover:border-indigo-500/20 transition-all">
              <span className="text-indigo-400 text-xl">✂️</span>
              <h4 className="font-bold text-sm text-slate-200 mt-2">Shorten</h4>
              <p className="text-xs text-slate-400 mt-1">Create short links in seconds</p>
            </div>
            <div className="glass p-4 rounded-xl border border-slate-800 hover:border-indigo-500/20 transition-all">
              <span className="text-indigo-400 text-xl">📊</span>
              <h4 className="font-bold text-sm text-slate-200 mt-2">Track</h4>
              <p className="text-xs text-slate-400 mt-1">Real-time analytics and insights</p>
            </div>
            <div className="glass p-4 rounded-xl border border-slate-800 hover:border-indigo-500/20 transition-all">
              <span className="text-indigo-400 text-xl">📤</span>
              <h4 className="font-bold text-sm text-slate-200 mt-2">Share</h4>
              <p className="text-xs text-slate-400 mt-1">Share anywhere with ease</p>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Card Forms */}
        <div className="w-full max-w-md">
          <div className="glass p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>

            {/* Render forms based on active tab state */}

            {/* tab: LOGIN */}
            {activeTab === 'login' && (
              <div className="space-y-5">
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-black text-white">Welcome Back!</h2>
                  <p className="text-xs text-slate-400 mt-1">Login to your account</p>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Enter your email"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                      <button 
                        type="button"
                        onClick={() => { setActiveTab('forgot-password'); setError(''); setSuccessMsg(''); }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter your password"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                      required
                    />
                  </div>

                  {error && <div className="p-3 bg-rose-950/40 border border-rose-900/30 text-rose-400 text-xs rounded-xl font-medium">{error}</div>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-sm"
                  >
                    {loading ? 'Logging in...' : 'Login'}
                  </button>
                </form>

                <div className="text-center text-xs text-slate-400 mt-4">
                  Don't have an account?{' '}
                  <button onClick={() => { setActiveTab('signup'); setError(''); }} className="text-indigo-400 hover:underline font-bold">
                    Sign Up
                  </button>
                </div>
              </div>
            )}

            {/* tab: SIGNUP */}
            {activeTab === 'signup' && (
              <div className="space-y-5">
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-black text-white">Create Your Account</h2>
                  <p className="text-xs text-slate-400 mt-1">Get started with link tracking</p>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Enter your name"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Enter your email"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Country</label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      placeholder="Enter your country"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Password</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Create a password"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                      required
                    />
                  </div>

                  {/* Admin registration capability removed for security */}

                  {error && <div className="p-3 bg-rose-950/40 border border-rose-900/30 text-rose-400 text-xs rounded-xl font-medium">{error}</div>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-sm"
                  >
                    {loading ? 'Creating...' : 'Sign Up'}
                  </button>
                </form>

                <div className="text-center text-xs text-slate-400 mt-4">
                  Already have an account?{' '}
                  <button onClick={() => { setActiveTab('login'); setError(''); }} className="text-indigo-400 hover:underline font-bold">
                    Login
                  </button>
                </div>
              </div>
            )}

            {/* tab: EMAIL VERIFICATION PAGE (Screen #3) */}
            {activeTab === 'verify-email' && (
              <div className="text-center space-y-6 py-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-3xl">
                    ✓
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">Verify Your Email</h2>
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                    We have sent a verification link to your email address. Please check your inbox and verify your email.
                  </p>
                </div>
                <button
                  onClick={() => { setActiveTab('login'); setError(''); }}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-sm"
                >
                  Go to Login
                </button>
              </div>
            )}

            {/* tab: FORGOT PASSWORD PAGE (Screen #12) */}
            {activeTab === 'forgot-password' && (
              <div className="space-y-5">
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-black text-white">Forgot Password?</h2>
                  <p className="text-xs text-slate-400 mt-1">Enter your email and we'll send you a link to reset your password.</p>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Enter your email"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                      required
                    />
                  </div>

                  {error && <div className="p-3 bg-rose-950/40 border border-rose-900/30 text-rose-400 text-xs rounded-xl font-medium">{error}</div>}
                  {successMsg && (
                    <div className="p-3 bg-indigo-950/40 border border-indigo-900/30 text-indigo-300 text-xs rounded-xl font-medium space-y-2">
                      <div>{successMsg}</div>
                      {generatedToken && (
                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-[10px] select-all">
                          Token: {generatedToken}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-sm"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>

                  {generatedToken && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('reset-password'); setError(''); setSuccessMsg(''); }}
                      className="w-full py-2 bg-indigo-950 border border-indigo-850 hover:bg-indigo-900 text-indigo-300 font-bold rounded-xl text-xs transition-colors"
                    >
                      Go to Reset Password Form →
                    </button>
                  )}

                  <div className="text-center">
                    <button 
                      type="button"
                      onClick={() => { setActiveTab('login'); setError(''); setSuccessMsg(''); setGeneratedToken(''); }}
                      className="text-xs text-indigo-400 hover:underline font-semibold"
                    >
                      Back to Login
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* tab: RESET PASSWORD PAGE (Screen #13) */}
            {activeTab === 'reset-password' && (
              <div className="space-y-5">
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-black text-white">Reset Your Password</h2>
                  <p className="text-xs text-slate-400 mt-1">Enter your reset token and new password below.</p>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Reset Token</label>
                    <input
                      type="text"
                      name="resetToken"
                      value={formData.resetToken}
                      onChange={handleInputChange}
                      placeholder="Paste reset-xxx token"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">New Password</label>
                    <input
                      type="password"
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      placeholder="Enter new password"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Confirm Password</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Confirm new password"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-200 text-sm"
                      required
                    />
                  </div>

                  {error && <div className="p-3 bg-rose-950/40 border border-rose-900/30 text-rose-400 text-xs rounded-xl font-medium">{error}</div>}
                  {successMsg && <div className="p-3 bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 text-xs rounded-xl font-medium">{successMsg}</div>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-sm"
                  >
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>

                  <div className="text-center">
                    <button 
                      type="button"
                      onClick={() => { setActiveTab('login'); setError(''); setSuccessMsg(''); }}
                      className="text-xs text-indigo-400 hover:underline font-semibold"
                    >
                      Back to Login
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* 3. Detailed Features Section (#features) */}
      <section id="features" className="py-20 px-6 max-w-7xl mx-auto w-full border-t border-slate-900 scroll-mt-6">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-3xl sm:text-4xl font-black text-white">Powerful Features</h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Linkify provides all the professional utility tools required to create, secure, and inspect your links at scale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all group">
            <span className="text-3xl">🔗</span>
            <h3 className="font-extrabold text-slate-200 mt-4 mb-2 group-hover:text-indigo-400 transition-colors">Custom Aliases</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Create branded redirects with customized slugs (e.g., `linkify.app/summer`) rather than random, auto-generated codes.
            </p>
          </div>
          <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all group">
            <span className="text-3xl">📊</span>
            <h3 className="font-extrabold text-slate-200 mt-4 mb-2 group-hover:text-indigo-400 transition-colors">Real-Time Trackers</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Observe click trends, browser engines, device types, referrers, and city locations instantly as they occur.
            </p>
          </div>
          <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all group">
            <span className="text-3xl">🔒</span>
            <h3 className="font-extrabold text-slate-200 mt-4 mb-2 group-hover:text-indigo-400 transition-colors">Password Locks</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Secure confidential documents or internal company directories by challenging visitors with a password gate.
            </p>
          </div>
          <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all group">
            <span className="text-3xl">📅</span>
            <h3 className="font-extrabold text-slate-200 mt-4 mb-2 group-hover:text-indigo-400 transition-colors">Expiration Dates</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Deactivate links automatically after campaigns conclude by specifying target deactivation dates and hours.
            </p>
          </div>
          <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all group">
            <span className="text-3xl">🟢</span>
            <h3 className="font-extrabold text-slate-200 mt-4 mb-2 group-hover:text-indigo-400 transition-colors">Link Health Checks</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Background servers periodically poll your destination URLs to detect broken paths, redirect errors, or server timeouts.
            </p>
          </div>
          <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/30 transition-all group">
            <span className="text-3xl">📤</span>
            <h3 className="font-extrabold text-slate-200 mt-4 mb-2 group-hover:text-indigo-400 transition-colors">CSV Bulk Upload</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Shorten hundreds of promotional links at once by uploading a formatted spreadsheet directly to the dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Pricing Plans Section (#pricing) */}
      <section id="pricing" className="py-20 px-6 max-w-7xl mx-auto w-full border-t border-slate-900 scroll-mt-6 pb-32">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-3xl sm:text-4xl font-black text-white">Simple, Flexible Pricing</h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Choose the plan that matches your redirect quotas and analytics monitoring requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card: Free */}
          <div className="glass p-8 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <h4 className="font-extrabold text-lg text-slate-200">Free Plan</h4>
              <div className="text-3xl font-black text-white">$0 <span className="text-sm font-semibold text-slate-500">/mo</span></div>
              <ul className="space-y-2 text-xs text-slate-400 pt-2">
                <li>• 10 Shortened URLs</li>
                <li>• Basic Click Counter</li>
                <li>• QR Code Generator</li>
                <li>• 7 Days Click History</li>
              </ul>
            </div>
            <button 
              onClick={() => setActiveTab('signup')}
              className="w-full py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
            >
              Get Started Free
            </button>
          </div>

          {/* Card: Pro */}
          <div className="glass p-8 rounded-2xl border border-indigo-500/30 bg-indigo-950/10 flex flex-col justify-between space-y-6 relative overflow-hidden">
            <span className="absolute top-3 right-3 bg-indigo-600 text-white font-extrabold text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider">
              Popular
            </span>
            <div className="space-y-4">
              <h4 className="font-extrabold text-lg text-indigo-400">Pro Plan</h4>
              <div className="text-3xl font-black text-white">$19 <span className="text-sm font-semibold text-slate-500">/mo</span></div>
              <ul className="space-y-2 text-xs text-slate-300 pt-2">
                <li>• Unlimited Shortened URLs</li>
                <li>• Custom Slugs / Aliases</li>
                <li>• Real-Time WebSocket Charts</li>
                <li>• PDF, Excel & CSV Exports</li>
                <li>• Password and Expiry Controls</li>
                <li>• 90 Days Click History</li>
              </ul>
            </div>
            <button 
              onClick={() => setActiveTab('signup')}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-indigo-600/20"
            >
              Upgrade to Pro
            </button>
          </div>

          {/* Card: Enterprise */}
          <div className="glass p-8 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <h4 className="font-extrabold text-lg text-slate-200">Enterprise Plan</h4>
              <div className="text-3xl font-black text-white">$49 <span className="text-sm font-semibold text-slate-500">/mo</span></div>
              <ul className="space-y-2 text-xs text-slate-400 pt-2">
                <li>• Unlimited Shortened URLs</li>
                <li>• Custom Domain Integrations</li>
                <li>• Multi-Member Workspaces</li>
                <li>• 365 Days Click History</li>
                <li>• Dedicated Support & SLA</li>
                <li>• Full REST API Access</li>
              </ul>
            </div>
            <button 
              onClick={() => setActiveTab('signup')}
              className="w-full py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
            >
              Contact Sales
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
