import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell
} from 'recharts';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsView({ urlId, addToast, socket }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveClicks, setLiveClicks] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, [urlId]);

  // Listen for real-time clicks via Socket
  useEffect(() => {
    if (socket) {
      const handleLiveClick = (clickData) => {
        if (clickData.urlId === urlId) {
          setLiveClicks(prev => [clickData, ...prev.slice(0, 4)]);
          fetchAnalytics(false); // Silent reload
        }
      };
      socket.on('new_click', handleLiveClick);
      return () => socket.off('new_click', handleLiveClick);
    }
  }, [socket, urlId]);

  const fetchAnalytics = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const stats = await api.analytics.getUrlAnalytics(urlId);
      setData(stats);
    } catch (err) {
      addToast(err.message || 'Failed to load link analytics', 'error');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleExport = (format) => {
    let url = '';
    if (format === 'csv') url = api.reports.getCSVUrl(urlId);
    else if (format === 'excel') url = api.reports.getExcelUrl(urlId);
    else if (format === 'pdf') url = api.reports.getPDFUrl(urlId);
    
    window.location.href = url;
    addToast(`Exporting report as ${format.toUpperCase()}...`, 'success');
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-xs">Loading analytics...</div>;
  }

  if (!data) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs">
        Failed to load analytics data. Please check your connection or try again.
      </div>
    );
  }

  const { urlInfo, metrics, recentHistory, charts } = data;

  // Format last click human-readable difference
  const formatLastClick = (time) => {
    if (!time) return 'Never';
    const diffMs = new Date() - new Date(time);
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    return new Date(time).toLocaleDateString();
  };

  // Calculate country percentages (for layout listing Screen #9)
  const totalClicks = metrics.totalClicks || 1;
  const countryPercentages = charts.countries.map(c => ({
    name: c.name,
    value: c.value,
    percentage: ((c.value / totalClicks) * 100).toFixed(0)
  }));

  // Device counts
  const totalDevices = charts.devices.reduce((acc, curr) => acc + curr.value, 0) || 1;
  const devicePercentages = charts.devices.map(d => ({
    name: d.name,
    value: d.value,
    percentage: ((d.value / totalDevices) * 100).toFixed(0)
  }));

  // Browser counts
  const totalBrowsers = (charts.browsers || []).reduce((acc, curr) => acc + curr.value, 0) || 1;
  const browserPercentages = (charts.browsers || []).map(b => ({
    name: b.name,
    value: b.value,
    percentage: ((b.value / totalBrowsers) * 100).toFixed(0)
  }));

  const topBrowser = (charts.browsers || []).length > 0
    ? [...charts.browsers].sort((a, b) => b.value - a.value)[0].name
    : 'None';

  return (
    <div className="space-y-6">
      
      {/* Header bar */}
      <div className="glass p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Link Details Analytics</div>
          <h2 className="text-2xl font-black text-white mt-1">linkify.app/{urlInfo.shortCode}</h2>
          <p className="text-xs text-slate-400 mt-1 truncate max-w-sm sm:max-w-md md:max-w-xl">
            Destination: <a href={urlInfo.originalUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">{urlInfo.originalUrl}</a>
          </p>
        </div>

        {/* Report downloads */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => handleExport('csv')}
            className="flex-1 md:flex-none px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold rounded-xl text-xs"
          >
            CSV Log
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="flex-1 md:flex-none px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-indigo-300 font-bold rounded-xl text-xs"
          >
            Excel Sheet
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/20"
          >
            PDF Report
          </button>
        </div>
      </div>

      {/* Metrics overview Cards (aligned with wireframe Screen #9) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="glass p-5 rounded-2xl relative overflow-hidden text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Clicks</div>
          <div className="text-3xl font-black mt-2 text-indigo-400">{metrics.totalClicks}</div>
        </div>
        <div className="glass p-5 rounded-2xl relative overflow-hidden text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unique Clicks</div>
          <div className="text-3xl font-black mt-2 text-emerald-400">{metrics.uniqueClicks}</div>
        </div>
        <div className="glass p-5 rounded-2xl relative overflow-hidden text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Countries</div>
          <div className="text-3xl font-black mt-2 text-amber-400">{charts.countries.length}</div>
        </div>
        <div className="glass p-5 rounded-2xl relative overflow-hidden text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Browser</div>
          <div className="text-2xl font-black mt-2 text-indigo-300 truncate" title={topBrowser}>
            {topBrowser}
          </div>
        </div>
        <div className="glass p-5 rounded-2xl relative overflow-hidden text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Last Click</div>
          <div className="text-xl font-extrabold mt-3 text-white truncate">
            {formatLastClick(metrics.lastVisitedTime)}
          </div>
        </div>
      </div>

      {/* Live visitor activity stream */}
      {liveClicks.length > 0 && (
        <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping-slow"></span>
            <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">Live Visit Stream</span>
          </div>
          <div className="space-y-1.5 mt-1">
            {liveClicks.map((click, i) => (
              <div key={i} className="text-xs text-slate-300 flex justify-between items-center bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-900">
                <span>
                  👤 New redirect click from <strong className="text-white">{click.city}, {click.country}</strong> using <strong className="text-white">{click.browser}</strong> ({click.device})
                </span>
                <span className="text-[10px] text-slate-500">{new Date(click.visitTime).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts split row (aligned with wireframe Screen #9) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Clicks Over Time (Bar Chart!) */}
        <div className="glass p-5 rounded-2xl md:col-span-2 space-y-4">
          <h3 className="font-extrabold text-base text-slate-200">Clicks Over Time</h3>
          <div className="h-64">
            {charts.clickTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">No clicks recorded yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.clickTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    labelStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="clicks" radius={[4, 4, 0, 0]}>
                    {charts.clickTrend.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Countries by Percentage listing (aligned with screen #9) */}
        <div className="glass p-5 rounded-2xl space-y-4">
          <h3 className="font-extrabold text-base text-slate-200">Top Countries</h3>
          <div className="space-y-4 overflow-y-auto max-h-64">
            {countryPercentages.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8">No country demographics.</div>
            ) : (
              countryPercentages.map((c, i) => (
                <div key={c.name} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">{c.name}</span>
                    <span className="text-slate-400 font-semibold">{c.value} ({c.percentage}%)</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${c.percentage}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Extra layout split: Device, Browser, and Referrer Distributions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Device Distribution */}
        <div className="glass p-5 rounded-2xl md:col-span-1 space-y-4">
          <h3 className="font-extrabold text-base text-slate-200">Device Distribution</h3>
          <div className="h-44 flex items-center justify-between gap-2">
            {devicePercentages.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8 w-full">No device demographics.</div>
            ) : (
              <>
                <div className="h-32 w-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.devices}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={48}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {charts.devices.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col space-y-1.5 overflow-y-auto max-h-36">
                  {devicePercentages.map((d, index) => (
                    <div key={d.name} className="flex items-center space-x-2 text-[10px]">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></span>
                      <span className="text-slate-400">{d.name}:</span>
                      <span className="font-bold text-slate-200">{d.percentage}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Browser Distribution */}
        <div className="glass p-5 rounded-2xl md:col-span-1 space-y-4">
          <h3 className="font-extrabold text-base text-slate-200">Browser Distribution</h3>
          <div className="h-44 flex items-center justify-between gap-2">
            {browserPercentages.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-8 w-full">No browser demographics.</div>
            ) : (
              <>
                <div className="h-32 w-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.browsers}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={48}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {charts.browsers.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col space-y-1.5 overflow-y-auto max-h-36">
                  {browserPercentages.map((b, index) => (
                    <div key={b.name} className="flex items-center space-x-2 text-[10px]">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[(index + 2) % CHART_COLORS.length] }}></span>
                      <span className="text-slate-400 truncate max-w-[65px]" title={b.name}>{b.name}:</span>
                      <span className="font-bold text-slate-200">{b.percentage}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Traffic Referrers bar listings */}
        <div className="glass p-5 rounded-2xl md:col-span-1 space-y-4">
          <h3 className="font-extrabold text-base text-slate-200">Referrer Channels</h3>
          <div className="grid grid-cols-2 gap-3 max-h-44 overflow-y-auto">
            {charts.referrers.length === 0 ? (
              <div className="col-span-2 text-center text-xs text-slate-500 py-8">No referrer details.</div>
            ) : (
              charts.referrers.slice(0, 4).map((ref, idx) => (
                <div key={ref.name} className="glass p-2 rounded-xl border border-slate-800 text-center">
                  <div className="text-slate-500 font-bold text-[8px] uppercase tracking-wider truncate" title={ref.name}>{ref.name}</div>
                  <div className="text-base font-black text-slate-200 mt-0.5">{ref.value}</div>
                  <div className="text-[9px] text-indigo-400 font-bold">
                    {((ref.value / totalClicks) * 100).toFixed(0)}%
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Visitor Click History Logs Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 bg-slate-900/20">
          <h3 className="font-extrabold text-base text-slate-200">Visits History Log</h3>
        </div>

        {recentHistory.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">No click logs recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider bg-slate-900/10">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">IP Address</th>
                  <th className="p-4">Device</th>
                  <th className="p-4">Browser</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Referrer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentHistory.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/10 transition-colors">
                    <td className="p-4 text-slate-450 font-semibold">{new Date(log.visit_time).toLocaleString()}</td>
                    <td className="p-4 font-mono text-[10px] text-slate-500">{log.ip_address}</td>
                    <td className="p-4">{log.device}</td>
                    <td className="p-4 font-bold text-indigo-300">{log.browser}</td>
                    <td className="p-4">{log.city}, {log.country}</td>
                    <td className="p-4 font-mono text-[10px] text-slate-500">{log.referrer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
