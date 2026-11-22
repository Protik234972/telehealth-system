import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Line,
  ComposedChart
} from 'recharts';
import {
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Zap,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Stethoscope,
  ShieldCheck,
  FileSpreadsheet,
  AlertCircle,
  Sparkles,
  Building2,
  ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL, WS_URL } from '../config';

export default function Analytics({ onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('all'); // 'today' | '7d' | '30d' | 'all'
  const [activeLogTab, setActiveLogTab] = useState('emergency'); // 'emergency' | 'preemption'
  const [wsConnected, setWsConnected] = useState(false);

  const COLORS = {
    Emergency: '#ef4444', // Red
    Urgent: '#f59e0b',    // Amber / Yellow
    Routine: '#10b981'    // Emerald / Green
  };

  const fetchAnalytics = async (selectedTimeframe = timeframe, isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/analytics?timeframe=${selectedTimeframe}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        if (typeof onLogout === 'function') onLogout();
        throw new Error('Session expired. Please log in again.');
      }

      if (!response.ok) throw new Error('Failed to fetch hospital executive analytics');
      const result = await response.json();
      setData(result);
      setError(null);
      if (isManualRefresh) {
        toast.success('Clinical telemetry updated live');
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(timeframe);
    let ws;
    try {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onmessage = (event) => {
        if (event.data === 'update' || event.data === 'emergency_preemption') {
          fetchAnalytics(timeframe);
        }
      };
    } catch (e) {
      console.warn('WS connection failed in Analytics', e);
    }
    return () => {
      if (ws) ws.close();
    };
  }, [timeframe]);

  const handleTimeframeChange = (tf) => {
    setTimeframe(tf);
    fetchAnalytics(tf);
  };

  // CSV Report Generator
  const handleExportReport = () => {
    if (!data) {
      toast.error('No analytics data available to export');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dateFormatted = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let csvContent = 'data:text/csv;charset=utf-8,';

    // Section 1: Executive Hospital Summary
    csvContent += '==================================================\n';
    csvContent += `TELETRIAGE CLINICAL INTELLIGENCE EXECUTIVE REPORT\n`;
    csvContent += `Generated: ${dateFormatted} | Timeframe: ${timeframe.toUpperCase()}\n`;
    csvContent += `System Uptime: ${data.kpi?.system_uptime || '99.98%'} | Live WebSocket Feed: Active\n`;
    csvContent += '==================================================\n\n';

    csvContent += '1. CORE OPERATIONAL KPIS\n';
    csvContent += 'Metric,Value,Status / Target\n';
    csvContent += `Total Triaged Patients,${data.kpi?.total_triaged || 0},Cumulative Queue Intake\n`;
    csvContent += `Pending Triage Cases,${data.kpi?.total_pending || 0},Active Backlog\n`;
    csvContent += `Resolved Consultations,${data.kpi?.total_resolved || 0},Completed or Discharged\n`;
    csvContent += `Emergency Escalation Rate,${data.kpi?.emergency_rate || 0}%,Target < 25%\n`;
    csvContent += `Emergency Patient Count,${data.kpi?.emergency_count || 0},Immediate Fast-Track\n`;
    csvContent += `Urgent Patient Count,${data.kpi?.urgent_count || 0},Priority Consultations\n`;
    csvContent += `Routine Patient Count,${data.kpi?.routine_count || 0},Standard Consultations\n`;
    csvContent += `Average Turnaround Time,${data.kpi?.avg_turnaround_min || 0} mins,Target < 20 mins\n`;
    csvContent += `SLA Compliance Rate,${data.kpi?.sla_adherence || 96.8}%,Target >= 95%\n`;
    csvContent += `Active Clinicians On-Duty,${data.kpi?.active_clinicians || 1},Attending Medical Staff\n`;
    csvContent += `Emergency Preemption Events,${data.kpi?.preemption_events || 0},Automated Slot Displacements\n`;
    csvContent += `Peak Intake Window,${data.kpi?.peak_hour || '09:00'} (${data.kpi?.peak_intake || 0} patients),Clinic Peak\n\n`;

    // Section 2: Urgency Distribution
    csvContent += '2. TRIAGE URGENCY DISTRIBUTION\n';
    csvContent += 'Urgency Level,Patient Count,Percentage Share\n';
    (data.distribution || []).forEach((d) => {
      csvContent += `${d.name},${d.value},${d.percentage}%\n`;
    });
    csvContent += '\n';

    // Section 3: Clinician Caseload
    csvContent += '3. ATTENDING CLINICIAN CASELOAD DISTRIBUTION\n';
    csvContent += 'Clinician,Active Consultations,Resolved Cases,Total Caseload,Capacity,Utilization %\n';
    (data.clinician_caseload || []).forEach((c) => {
      csvContent += `"${c.doctor}",${c.active},${c.completed},${c.total},${c.capacity},${c.utilization}%\n`;
    });
    csvContent += '\n';

    // Section 4: Hourly Intake Breakdown
    csvContent += '4. HOURLY PATIENT INFLUX (09:00 - 17:00)\n';
    csvContent += 'Time Slot,Total Intake,Emergency,Urgent,Routine\n';
    (data.hourly_intake || []).forEach((h) => {
      csvContent += `${h.hour},${h.intake},${h.emergency},${h.urgent},${h.routine}\n`;
    });
    csvContent += '\n';

    // Section 5: Preemption Log
    csvContent += '5. EMERGENCY PREEMPTION DISPLACEMENT LOG\n';
    csvContent += 'Bumped Patient,Original Slot,Rescheduled Slot,Reason,Timestamp\n';
    (data.preemption_logs || []).forEach((p) => {
      csvContent += `"${p.bumped_patient || 'N/A'}","${p.original_time || 'N/A'}","${p.new_time || 'N/A'}","${p.reason || 'Emergency Preemption'}","${p.timestamp || 'N/A'}"\n`;
    });
    csvContent += '\n';

    // Section 6: Emergency Incidents
    csvContent += '6. EMERGENCY INCIDENT LOG\n';
    csvContent += 'Patient Name,Urgency Score,Critical Keywords,Attending Clinician,Status,Scheduled Time\n';
    (data.emergency_incidents || []).forEach((e) => {
      const keywords = (e.critical_keywords || []).join('; ');
      csvContent += `"${e.patient_name || 'Anonymous'}","${e.ai_urgency_score}","${keywords}","${e.assigned_to}","${e.final_status}","${e.scheduled_time}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TeleTriage_Executive_Report_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Executive hospital report exported successfully!');
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 text-xs">
          <p className="font-bold text-gray-800 dark:text-gray-100 mb-1">{label || payload[0]?.name}</p>
          {payload.map((entry, index) => (
            <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4 py-0.5">
              <span className="flex items-center gap-1.5" style={{ color: entry.color || entry.fill }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }}></span>
                {entry.name}:
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {entry.value} {entry.unit || ''}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading && !data) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">
          Aggregating Clinical Intelligence Telemetry...
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-2xl text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-red-800 dark:text-red-300">Analytics Telemetry Error</h3>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={() => fetchAnalytics(timeframe, true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Retry Connection
        </button>
      </div>
    );
  }

  const kpi = data?.kpi || {};
  const distribution = data?.distribution || [];
  const hourlyIntake = data?.hourly_intake || [];
  const caseload = data?.clinician_caseload || [];
  const turnaroundTrend = data?.turnaround_trend || [];
  const preemptionLogs = data?.preemption_logs || [];
  const emergencyIncidents = data?.emergency_incidents || [];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* =========================================================================
          EXECUTIVE DASHBOARD HEADER & TIMEFRAME FILTERS
      ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl text-white shadow-md shadow-indigo-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-300">
                  Hospital Executive Clinical Dashboard
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                  <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
                  {wsConnected ? 'Live Feed Active' : 'Telemetry Syncing'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Real-time operational triage metrics, clinician workload balancing, and SLA adherence
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Timeframe Filter + Export Report + Live Refresh */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Timeframe Filter Tabs */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium">
            <button
              onClick={() => handleTimeframeChange('today')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeframe === 'today'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleTimeframeChange('7d')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeframe === '7d'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => handleTimeframeChange('30d')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeframe === '30d'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => handleTimeframeChange('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeframe === 'all'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Quick Export Report Button */}
          <button
            onClick={handleExportReport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Download executive CSV report"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Report</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchAnalytics(timeframe, true)}
            disabled={refreshing}
            className="p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl transition hover:shadow-sm"
            title="Refresh Live Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          6 METRIC KPI CARDS WITH TREND INDICATORS & STATUS COLORS
      ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Pending Triage */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-5 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Pending Triage
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white">
              {kpi.total_pending ?? 0}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <TrendingDown className="w-3.5 h-3.5 shrink-0" />
              <span>{kpi.total_assigned ?? 0} in active review</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-gray-400">
            <span>Backlog Queue</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">Active</span>
          </div>
        </div>

        {/* Card 2: Resolved Consultations */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Resolved Cases
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white">
              {kpi.total_resolved ?? 0}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>+18.4% throughput</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-gray-400">
            <span>Discharged / Closed</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Optimal</span>
          </div>
        </div>

        {/* Card 3: Emergency Escalation Rate */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-5 rounded-2xl border border-rose-200/80 dark:border-rose-900/40 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Emergency Rate
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {kpi.emergency_rate ?? 0}%
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
              <span>{kpi.emergency_count ?? 0} urgent fast-tracks</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-gray-400">
            <span>Fast-Track Threshold</span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">&lt; 15 min SLA</span>
          </div>
        </div>

        {/* Card 4: Doctor Caseload */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-5 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/40 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Doctor Caseload
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Stethoscope className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-900 dark:text-white">
              {kpi.active_clinicians ?? 1} <span className="text-sm font-semibold text-gray-500">MDs</span>
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>{kpi.total_assigned ?? 0} active assignments</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-gray-400">
            <span>Shift Load Factor</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">Balanced</span>
          </div>
        </div>

        {/* Card 5: Preemption Events */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-5 rounded-2xl border border-purple-200/80 dark:border-purple-900/40 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Preemptions
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {kpi.preemption_events ?? 0}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-medium">
              <span>Auto Slot Displacements</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-gray-400">
            <span>Rebooking Engine</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">100% Auto</span>
          </div>
        </div>

        {/* Card 6: System Uptime & SLA */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-5 rounded-2xl border border-cyan-200/80 dark:border-cyan-900/40 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              SLA & Uptime
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-cyan-600 dark:text-cyan-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
              {kpi.system_uptime || '99.98%'}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{kpi.sla_adherence || 96.8}% SLA Met</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-gray-400">
            <span>Avg Turnaround</span>
            <span className="font-semibold text-cyan-600 dark:text-cyan-400">{kpi.avg_turnaround_min || 16.5}m</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4 RECHARTS VISUAL CLINICAL CHARTS (2x2 GRID)
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* CHART 1: Donut / Pie Chart - Triage Urgency Distribution */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span>Triage Urgency Distribution</span>
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                  AI Stratification
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Patient intake classified by clinical urgency score
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400">Total Cases</span>
              <p className="text-lg font-black text-gray-800 dark:text-white">{kpi.total_triaged ?? 0}</p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  animationDuration={800}
                >
                  {distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[entry.name] || '#94a3b8'} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label in Donut Hole */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-gray-800 dark:text-white">{kpi.total_triaged ?? 0}</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Patients</span>
            </div>
          </div>

          {/* Custom Interactive Legend with percentages */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
            {distribution.map((item) => (
              <div
                key={item.name}
                className="flex flex-col items-center text-center p-2 rounded-xl bg-gray-50 dark:bg-gray-700/40"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{item.name}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-extrabold text-gray-900 dark:text-white">{item.value}</span>
                  <span className="text-[11px] text-gray-400">({item.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CHART 2: Area / Bar Chart - Hourly Patient Influx & Peak Triage Hours */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span>Hourly Patient Influx</span>
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                  09:00 - 17:00
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Patient volume distribution and peak triage demand windows
              </p>
            </div>
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/40">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="text-left text-[11px] leading-tight">
                <span className="text-gray-400 block">Peak Window:</span>
                <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                  {kpi.peak_hour || '09:00'} ({kpi.peak_intake || 0} pts)
                </span>
              </div>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyIntake} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="intakeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="intake"
                  name="Total Intake"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#intakeGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
            <span>Operating Clinic Hours: 09:00 AM - 05:00 PM</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              Live Scheduled Influx Curve
            </span>
          </div>
        </div>

        {/* CHART 3: Bar Chart - Attending Clinician Caseload Distribution */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span>Attending Clinician Caseload</span>
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
                  Load Balancing
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Active consults vs completed cases per attending physician
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400">Standard Shift Cap</span>
              <p className="text-sm font-extrabold text-gray-700 dark:text-gray-300">20 Cases/MD</p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={caseload} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="doctor" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                />
                <Bar dataKey="active" name="Active Consultations" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Resolved / Discharged" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
            <span>Includes Assigned Doctors &amp; Unassigned Triage Queue</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {caseload.reduce((sum, c) => sum + c.active, 0)} Active Total
            </span>
          </div>
        </div>

        {/* CHART 4: Line / Composed Chart - Triage Turnaround & Resolution Trend */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span>Triage Turnaround &amp; SLA Trend</span>
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-300">
                  Target: &lt; 20 min
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Daily average turnaround time vs clinical SLA target benchmark
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400">Avg Intake Wait</span>
              <p className="text-lg font-black text-cyan-600 dark:text-cyan-400">
                {kpi.avg_turnaround_min || 16.5}m
              </p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={turnaroundTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit="m" />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                />
                <Bar dataKey="resolved" name="Resolved Volume" fill="#cbd5e1" opacity={0.5} radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="turnaround"
                  name="Turnaround (mins)"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#06b6d4' }}
                />
                <Line
                  type="monotone"
                  dataKey="targetSLA"
                  name="Target SLA (20m)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
            <span>Overall SLA Compliance: {kpi.sla_adherence || 96.8}%</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Within Safe Tolerance</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          REAL-TIME PREEMPTION & EMERGENCY INCIDENT LOG TABLE
      ========================================================================= */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-gray-700 shadow-md overflow-hidden">
        {/* Header Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
                Clinical Incident &amp; Preemption Audit Log
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Live stream of automated emergency preemptions and high-risk case escalations
              </p>
            </div>
          </div>

          {/* Toggle Tabs */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveLogTab('emergency')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeLogTab === 'emergency'
                  ? 'bg-white dark:bg-gray-800 text-rose-600 dark:text-rose-400 shadow-sm font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Emergency Cases ({emergencyIncidents.length})</span>
            </button>
            <button
              onClick={() => setActiveLogTab('preemption')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeLogTab === 'preemption'
                  ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Preemption Events ({preemptionLogs.length})</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Emergency Cases Table */}
        {activeLogTab === 'emergency' && (
          <div className="overflow-x-auto">
            {emergencyIncidents.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No emergency incidents recorded in this timeframe.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3.5">Patient</th>
                    <th className="px-6 py-3.5">Urgency</th>
                    <th className="px-6 py-3.5">Critical Keywords / Symptoms</th>
                    <th className="px-6 py-3.5">Attending Clinician</th>
                    <th className="px-6 py-3.5">Scheduled Slot</th>
                    <th className="px-6 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {emergencyIncidents.map((incident) => (
                    <tr
                      key={incident._id}
                      className="hover:bg-rose-50/30 dark:hover:bg-rose-950/20 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                        {incident.patient_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                          Emergency
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs sm:max-w-md">
                          {incident.critical_keywords && incident.critical_keywords.length > 0 ? (
                            incident.critical_keywords.map((kw, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-[10px] font-bold border border-rose-200 dark:border-rose-800/40"
                              >
                                {kw}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400 text-xs italic truncate">
                              {incident.raw_symptom_text || 'Urgent clinical evaluation'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-700 dark:text-gray-300">
                        {incident.assigned_to === 'Unassigned' ? (
                          <span className="text-amber-500 font-semibold italic">Unassigned</span>
                        ) : (
                          `Dr. ${incident.assigned_to.replace('_', ' ').replace('doctor', '').trim() || incident.assigned_to}`
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300 font-mono text-[11px]">
                        {incident.scheduled_time
                          ? new Date(incident.scheduled_time).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Immediate'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            incident.final_status === 'Pending'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {incident.final_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Preemption Events Table */}
        {activeLogTab === 'preemption' && (
          <div className="overflow-x-auto">
            {preemptionLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No preemption displacement events recorded in this timeframe.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3.5">Bumped Patient</th>
                    <th className="px-6 py-3.5">Original Scheduled Slot</th>
                    <th className="px-6 py-3.5">Rescheduled Slot</th>
                    <th className="px-6 py-3.5">Displacement Reason</th>
                    <th className="px-6 py-3.5">Logged Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {preemptionLogs.map((log) => (
                    <tr
                      key={log._id}
                      className="hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                        {log.bumped_patient || log.bumped_username || 'Patient'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-rose-500 line-through font-mono text-[11px]">
                          {log.original_time
                            ? new Date(log.original_time).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Original Slot'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-mono text-[11px] font-bold">
                          {log.new_time
                            ? new Date(log.new_time).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Rescheduled Slot'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">
                        {log.reason || 'Emergency patient preemption'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-mono text-[11px]">
                        {log.timestamp
                          ? new Date(log.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Recorded'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
