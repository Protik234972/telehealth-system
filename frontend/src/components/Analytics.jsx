import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Clock, CheckCircle } from 'lucide-react';
import { API_URL, WS_URL } from '../config';

export default function Analytics({ onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const COLORS = {
    'Emergency': '#ef4444', // Red
    'Urgent': '#eab308',    // Yellow
    'Routine': '#22c55e'    // Green
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401) {
        if (typeof onLogout === 'function') onLogout();
        throw new Error('Session expired.');
      }

      if (!response.ok) throw new Error('Failed to fetch analytics');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      if (event.data === 'update') {
        fetchAnalytics();
      }
    };
    return () => ws.close();
  }, []);

  if (loading && !data) {
    return <div className="text-center mt-20 text-gray-500">Loading Analytics...</div>;
  }

  if (error) {
    return <div className="text-center mt-20 text-red-500">{error}</div>;
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6 mt-6">
      <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600 mb-8">
        Hospital Analytics Overview
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Triaged (Pending)</p>
            <h3 className="text-3xl font-bold text-gray-800">{data?.kpi?.total_pending || 0}</h3>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-green-100 rounded-full text-green-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Resolved</p>
            <h3 className="text-3xl font-bold text-gray-800">{data?.kpi?.total_resolved || 0}</h3>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-purple-100 rounded-full text-purple-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">System Status</p>
            <h3 className="text-2xl font-bold text-gray-800 text-green-500 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Live
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-lg border border-gray-100">
        <h3 className="text-xl font-bold text-gray-700 mb-6">Current Triage Distribution</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data?.distribution || []}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {(data?.distribution || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#cbd5e1'} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Patients']} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
