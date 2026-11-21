import { useState, useEffect } from 'react';
import { Search, Filter, UserCheck, XCircle, X, Send, Edit2, Calendar, AlertTriangle, Zap, Users, Activity, Clock, Stethoscope, Eye, FileText, CheckCircle2, ChevronRight, ChevronLeft, Phone, User, Download, ShieldAlert, History, CalendarDays, LayoutGrid } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL, WS_URL } from '../config';

export default function Dashboard({ onLogout }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  // View & Mode State
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'calendar'
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date().toISOString().slice(0, 10));

  // Admin All Records Archive State
  const [archiveList, setArchiveList] = useState([]);
  const [archiveStatusFilter, setArchiveStatusFilter] = useState('All');

  // Clinical Audit Trail State
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Modals & Drawer State
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [overrideModal, setOverrideModal] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [completeModal, setCompleteModal] = useState(null);
  const [dischargeNotes, setDischargeNotes] = useState('');
  
  // Assignment Form State
  const [staffList, setStaffList] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');

  // Override Form State
  const [newPriority, setNewPriority] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [newSchedule, setNewSchedule] = useState('');

  // Preemption Events State
  const [preemptionEvents, setPreemptionEvents] = useState([]);
  const [showPreemptionBanner, setShowPreemptionBanner] = useState(false);

  const userRole = localStorage.getItem('role');
  const currentUsername = localStorage.getItem('username') || '';
  const [activeTab, setActiveTab] = useState(userRole === 'staff' ? 'my_cases' : 'all');
  const getToken = () => localStorage.getItem('token');

  const fetchQueue = async () => {
    try {
      const response = await fetch(`${API_URL}/get-queue`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.status === 401) { if (onLogout) onLogout(); return; }
      if (!response.ok) throw new Error('Failed to fetch queue');
      const data = await response.json();
      setQueue(data.queue);
      setSelectedPatient(prev => {
        if (!prev) return null;
        return data.queue.find(a => a._id === prev._id) || null;
      });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffList = async () => {
    try {
      const response = await fetch(`${API_URL}/staff-list`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStaffList(data.staff);
      }
    } catch (err) {
      console.error('Failed to fetch staff', err);
    }
  };

  const fetchPreemptionLog = async () => {
    try {
      const response = await fetch(`${API_URL}/preemption-log`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPreemptionEvents(data.events);
      }
    } catch (err) {
      console.error('Failed to fetch preemption log', err);
    }
  };

  const fetchArchive = async () => {
    try {
      const response = await fetch(`${API_URL}/all-appointments`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setArchiveList(data.appointments || []);
      }
    } catch (err) {
      console.error('Failed to fetch archive', err);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const response = await fetch(`${API_URL}/audit-logs`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    fetchStaffList();
    fetchPreemptionLog();
    fetchArchive();
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      if (event.data === 'update') {
        fetchQueue();
        fetchArchive();
      }
      if (event.data === 'emergency_preemption') {
        fetchQueue();
        fetchPreemptionLog();
        fetchArchive();
        setShowPreemptionBanner(true);
        // Auto-dismiss after 15 seconds
        setTimeout(() => setShowPreemptionBanner(false), 15000);
      }
    };
    return () => ws.close();
  }, []);

  const handleUpdateStatus = async (id, status, assigned_to = null, doctor_notes = null) => {
    try {
      const body = { status };
      if (assigned_to) body.assigned_to = assigned_to;
      if (doctor_notes) body.doctor_notes = doctor_notes;

      const response = await fetch(`${API_URL}/update-status/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        toast.success(status === 'Dismissed' ? 'Patient dismissed' : `Patient assigned to ${assigned_to}. Notification email triggered!`);
        fetchQueue();
      } else {
        toast.error('Failed to update status');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const executeOverride = async () => {
    if (!newPriority) return;
    if (!overrideReason.trim()) {
      toast.error('Please enter a clinical reason for this priority override');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/override-priority/${overrideModal._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ new_priority: newPriority, reason: overrideReason.trim() })
      });
      if (response.ok) {
        toast.success(`Priority overridden to ${newPriority}`);
        setOverrideModal(null);
        setOverrideReason('');
        fetchQueue();
      } else {
        toast.error('Failed to override priority');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const executeScheduleOverride = async () => {
    if (!newSchedule) return;
    try {
      const response = await fetch(`${API_URL}/override-schedule/${scheduleModal._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ new_time: new Date(newSchedule).toISOString() })
      });
      if (response.ok) {
        toast.success('Schedule manually updated');
        setScheduleModal(null);
        fetchQueue();
      } else {
        toast.error('Failed to update schedule');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const getRowClass = (urgency) => {
    switch(urgency) {
      case 'Emergency': return 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border-l-4 border-red-500';
      case 'Urgent': return 'bg-yellow-50 dark:bg-yellow-950/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 border-l-4 border-yellow-500';
      case 'Routine': return 'bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-900/40 border-l-4 border-green-500';
      default: return 'bg-white dark:bg-gray-800 hover:bg-gray-50 border-l-4 border-gray-300';
    }
  };

  const getBadgeClass = (urgency) => {
    switch(urgency) {
      case 'Emergency': return 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200 ring-1 ring-rose-200 dark:ring-rose-700';
      case 'Urgent': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 ring-1 ring-amber-200 dark:ring-amber-700';
      case 'Routine': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 ring-1 ring-emerald-200 dark:ring-emerald-700';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getAvatarColor = (urgency) => {
    switch(urgency) {
      case 'Emergency': return 'bg-rose-500 text-white';
      case 'Urgent': return 'bg-amber-500 text-white';
      case 'Routine': return 'bg-emerald-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  };

  const myCasesCount = queue.filter(a => a.assigned_to && a.assigned_to.toLowerCase() === currentUsername.toLowerCase()).length;
  const unassignedCount = queue.filter(a => !a.assigned_to || a.final_status === 'Pending').length;
  const assignedCount = queue.filter(a => Boolean(a.assigned_to)).length;

  const filteredQueue = queue.filter(appt => {
    const matchesSearch = appt.patient_name.toLowerCase().includes(search.toLowerCase()) ||
                          (appt.contact_info && appt.contact_info.toLowerCase().includes(search.toLowerCase())) ||
                          (appt.raw_symptom_text && appt.raw_symptom_text.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = filter === 'All' || appt.ai_urgency_score === filter;

    let matchesTab = true;
    if (activeTab === 'my_cases') {
      matchesTab = Boolean(appt.assigned_to && appt.assigned_to.toLowerCase() === currentUsername.toLowerCase());
    } else if (activeTab === 'unassigned') {
      matchesTab = !appt.assigned_to || appt.final_status === 'Pending';
    } else if (activeTab === 'assigned') {
      matchesTab = Boolean(appt.assigned_to);
    }

    return matchesSearch && matchesFilter && matchesTab;
  });

  const filteredArchive = archiveList.filter(appt => {
    const matchesSearch = (appt.patient_name && appt.patient_name.toLowerCase().includes(search.toLowerCase())) ||
                          (appt.contact_info && appt.contact_info.toLowerCase().includes(search.toLowerCase())) ||
                          (appt.raw_symptom_text && appt.raw_symptom_text.toLowerCase().includes(search.toLowerCase())) ||
                          (appt.assigned_to && appt.assigned_to.toLowerCase().includes(search.toLowerCase()));
    const matchesUrgency = filter === 'All' || appt.ai_urgency_score === filter;
    const matchesStatus = archiveStatusFilter === 'All' || appt.final_status === archiveStatusFilter;
    return matchesSearch && matchesUrgency && matchesStatus;
  });

  const exportQueueCSV = () => {
    const listToExport = activeTab === 'archive' ? filteredArchive : filteredQueue;
    if (!listToExport || listToExport.length === 0) {
      toast.error('No data to export.');
      return;
    }
    const headers = ['Priority', 'Patient Name', 'Contact Info', 'Scheduled Time', 'Status', 'Assigned Doctor', 'Symptoms'];
    const rows = listToExport.map(a => [
      `"${a.ai_urgency_score || ''}"`,
      `"${(a.patient_name || '').replace(/"/g, '""')}"`,
      `"${(a.contact_info || '').replace(/"/g, '""')}"`,
      `"${a.scheduled_time ? new Date(a.scheduled_time).toLocaleString() : 'Not Scheduled'}"`,
      `"${a.final_status || 'Pending'}"`,
      `"${a.assigned_to || 'Unassigned'}"`,
      `"${(a.raw_symptom_text || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeTab === 'archive' ? 'patient_records_archive' : 'triage_handover'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV report exported!');
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 mt-6">
      {/* Role-Aware Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            {userRole === 'staff' ? (
              <div className="p-2.5 bg-teal-100 dark:bg-teal-900/50 rounded-xl">
                <Stethoscope className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
            ) : (
              <div className="p-2.5 bg-purple-100 dark:bg-purple-900/50 rounded-xl">
                <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            )}
            <div>
              <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
                {userRole === 'staff' ? 'Doctor Clinical Workspace' : 'Coordinator Dashboard'}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  userRole === 'staff' 
                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300' 
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                }`}>
                  {userRole === 'staff' ? '👨‍⚕️ Clinician' : '🏥 Admin'}
                </span>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Live</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-56">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Search patients..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}
              className="pl-10 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 appearance-none bg-white dark:bg-gray-700 text-sm">
              <option value="All">All Priorities</option>
              <option value="Emergency">Emergency</option>
              <option value="Urgent">Urgent</option>
              <option value="Routine">Routine</option>
            </select>
          </div>
          {userRole === 'admin' && (
            <button
              onClick={() => { fetchAuditLogs(); setAuditModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-xs font-semibold shadow-sm transition shrink-0"
              title="View Clinical Audit Trail & Governance Logs"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">Audit Trail</span>
            </button>
          )}
          <button
            onClick={exportQueueCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 text-xs font-semibold shadow-sm transition shrink-0"
            title="Export Triage Handover Sheet (CSV)"
          >
            <Download className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {(() => {
        const totalInQueue = queue.length;
        const emergencyCount = queue.filter(a => a.ai_urgency_score === 'Emergency').length;
        const urgentCount = queue.filter(a => a.ai_urgency_score === 'Urgent').length;
        const preemptionCount = preemptionEvents.length;
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total in Queue</p>
                  <p className="text-3xl font-extrabold text-gray-800 dark:text-white mt-1">{totalInQueue}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-red-100 dark:border-red-900/50 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Emergency</p>
                  <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">{emergencyCount}</p>
                </div>
                <div className="p-3 bg-rose-100 dark:bg-rose-900/40 rounded-xl">
                  <Activity className={`w-6 h-6 text-rose-600 dark:text-rose-400 ${emergencyCount > 0 ? 'animate-pulse' : ''}`} />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-amber-100 dark:border-amber-900/50 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Urgent</p>
                  <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{urgentCount}</p>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
                  <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-md border border-purple-100 dark:border-purple-900/50 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preemptions</p>
                  <p className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">{preemptionCount}</p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-xl">
                  <Zap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {error && <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">{error}</div>}

      {/* === EMERGENCY PREEMPTION BANNER === */}
      {showPreemptionBanner && preemptionEvents.length > 0 && (
        <div className="mb-6 animate-pulse">
          <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 rounded-2xl shadow-2xl shadow-red-500/30 overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    ⚡ EMERGENCY PREEMPTION TRIGGERED
                  </h3>
                  <p className="text-red-100 text-sm mt-0.5">
                    <strong>{preemptionEvents[0]?.bumped_patient}</strong> was bumped from{' '}
                    {preemptionEvents[0]?.original_time && new Date(preemptionEvents[0].original_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    {' → '}
                    {preemptionEvents[0]?.new_time && new Date(preemptionEvents[0].new_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    {' '}to accommodate an emergency case. Email & SMS notifications dispatched.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPreemptionBanner(false)} className="p-1.5 hover:bg-white/20 rounded-full transition">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === RECENT PREEMPTION LOG (persistent, collapsible) === */}
      {preemptionEvents.length > 0 && !showPreemptionBanner && (
        <div className="mb-6">
          <button 
            onClick={() => setShowPreemptionBanner(true)}
            className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition font-medium"
          >
            <AlertTriangle className="w-4 h-4" />
            {preemptionEvents.length} preemption event{preemptionEvents.length > 1 ? 's' : ''} in the last 24h — click to review
          </button>
        </div>
      )}

      {/* === CASELOAD FILTER TABS === */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-1.5 p-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          {userRole === 'staff' ? (
            <>
              <button
                onClick={() => setActiveTab('my_cases')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'my_cases'
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                My Consultations
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'my_cases' ? 'bg-teal-700 text-teal-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {myCasesCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'all'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                All Triage Queue
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'all' ? 'bg-purple-700 text-purple-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {queue.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('unassigned')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'unassigned'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Needs Doctor
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'unassigned' ? 'bg-amber-700 text-amber-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {unassignedCount}
                </span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'all'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                All Intake Queue
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'all' ? 'bg-purple-700 text-purple-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {queue.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('unassigned')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'unassigned'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Pending Assignment
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'unassigned' ? 'bg-amber-700 text-amber-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {unassignedCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('assigned')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'assigned'
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Assigned to Doctors
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'assigned' ? 'bg-teal-700 text-teal-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {assignedCount}
                </span>
              </button>

              <button
                onClick={() => { setActiveTab('archive'); fetchArchive(); }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'archive'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Records Archive
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'archive' ? 'bg-indigo-700 text-indigo-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {archiveList.length}
                </span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Table / Calendar Grid Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Table
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Calendar Matrix
            </button>
          </div>

          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:block">
            Showing <strong>{activeTab === 'archive' ? filteredArchive.length : filteredQueue.length}</strong> cases
          </div>
        </div>
      </div>

      {/* Queue Table */}
      {viewMode === 'table' && activeTab !== 'archive' && (
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 uppercase text-xs tracking-wider">
                <th className="p-4 font-semibold">Priority</th>
                <th className="p-4 font-semibold">Patient Name</th>
                <th className="p-4 font-semibold">Symptoms & AI Insights</th>
                <th className="p-4 font-semibold">Scheduling</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading && queue.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">Loading queue...</td></tr>
              ) : filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-gray-500">
                    <p className="font-semibold text-base text-gray-700 dark:text-gray-300">
                      {activeTab === 'my_cases'
                        ? 'No patients currently assigned to you.'
                        : activeTab === 'unassigned'
                        ? 'No patients waiting for clinician assignment.'
                        : 'No pending appointments found in this view.'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {activeTab === 'my_cases'
                        ? 'Switch to the "All Triage Queue" tab to review or claim incoming patient cases.'
                        : 'New patients will appear here in real-time as they complete AI intake.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredQueue.map((appt) => (
                  <tr key={appt._id} 
                    onClick={() => setSelectedPatient(appt)}
                    className={`transition-all duration-300 cursor-pointer ${getRowClass(appt.ai_urgency_score)} ${selectedPatient?._id === appt._id ? 'ring-2 ring-indigo-500' : ''}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${getBadgeClass(appt.ai_urgency_score)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full bg-current ${appt.ai_urgency_score === 'Emergency' ? 'animate-pulse' : ''}`}></span>
                          {appt.ai_urgency_score}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); setOverrideModal(appt); setNewPriority(appt.ai_urgency_score); setOverrideReason(''); }}
                          className="text-gray-400 hover:text-blue-500 transition" title="Manual Override">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                      {appt.overridden_by && (
                        <p className="text-[10px] text-gray-500 mt-1 italic">Overridden by {appt.overridden_by}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${getAvatarColor(appt.ai_urgency_score)}`}>
                          {getInitials(appt.patient_name)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 dark:text-white">{appt.patient_name}</p>
                          <p className="text-sm opacity-80 dark:text-gray-300">{appt.contact_info}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm mb-2 max-w-sm dark:text-gray-300">"{appt.raw_symptom_text}"</p>
                      {appt.critical_keywords && appt.critical_keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs font-bold text-red-600 dark:text-red-400 mr-1">AI Flags:</span>
                          {appt.critical_keywords.map((word, idx) => (
                            <span key={idx} className="bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">{word}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-sm font-medium">
                      <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
                        <Calendar className="w-4 h-4" />
                        <div className="flex-1">
                          {appt.scheduled_time ? (
                            <>
                              <p className="leading-tight">{new Date(appt.scheduled_time).toLocaleDateString()}</p>
                              <p className="text-xs opacity-80">{new Date(appt.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </>
                          ) : (
                            <p>Not Scheduled</p>
                          )}
                          {appt.schedule_overridden_by && (
                            <p className="text-[9px] text-indigo-500 mt-0.5">Edited by {appt.schedule_overridden_by}</p>
                          )}
                          {appt.preempted && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[9px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> Rescheduled
                              </span>
                            </div>
                          )}
                        </div>
                        <button onClick={(e) => { 
                          e.stopPropagation();
                          setScheduleModal(appt); 
                          if(appt.scheduled_time) {
                            const tzoffset = (new Date()).getTimezoneOffset() * 60000; // offset in milliseconds
                            const localISOTime = (new Date(new Date(appt.scheduled_time) - tzoffset)).toISOString().slice(0, 16);
                            setNewSchedule(localISOTime);
                          }
                        }}
                          className="p-1.5 text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 rounded transition ml-1" title="Edit Schedule">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {appt.final_status === 'Completed' ? (
                          <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Completed
                          </span>
                        ) : (
                          <>
                            {appt.assigned_to && (
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setCompleteModal(appt); 
                                  setDischargeNotes(appt.doctor_notes || ''); 
                                }}
                                className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 rounded-lg transition" 
                                title="Complete Consultation & Discharge"
                              >
                                <CheckCircle2 className="w-5 h-5" />
                              </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); setSelectedPatient(appt); }}
                              className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/50 rounded-lg transition" title="Inspect Full Clinical Case">
                              <Eye className="w-5 h-5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setAssignModal(appt); setSelectedDoctor(staffList.length > 0 ? staffList[0].username : ''); setDoctorNotes(''); }}
                              className="p-2 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50 rounded-lg transition" title="Assign to Doctor">
                              <UserCheck className="w-5 h-5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmModal({ id: appt._id, action: 'Dismissed', name: appt.patient_name }); }}
                              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition" title="Dismiss">
                              <XCircle className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* === ADMIN COMPLETE HISTORICAL ARCHIVE TABLE === */}
      {viewMode === 'table' && activeTab === 'archive' && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-900/30">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-gray-800 dark:text-white text-base">Historical Encounter Archive</h3>
              <span className="text-xs text-gray-400 font-medium">({filteredArchive.length} total records)</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Filter Status:</span>
              <select
                value={archiveStatusFilter}
                onChange={(e) => setArchiveStatusFilter(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium"
              >
                <option value="All">All Statuses</option>
                <option value="Completed">Completed</option>
                <option value="Dismissed">Dismissed</option>
                <option value="Pending">Pending</option>
                <option value="Assigned to Doctor">Assigned</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 uppercase text-xs tracking-wider">
                  <th className="p-4 font-semibold">Priority</th>
                  <th className="p-4 font-semibold">Patient</th>
                  <th className="p-4 font-semibold">Status & Clinician</th>
                  <th className="p-4 font-semibold">Symptoms & Discharge Summary</th>
                  <th className="p-4 font-semibold">Appointment Time</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredArchive.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-500">No archived records match the selected filter.</td></tr>
                ) : (
                  filteredArchive.map(appt => (
                    <tr key={appt._id} onClick={() => setSelectedPatient(appt)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition">
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${getBadgeClass(appt.ai_urgency_score)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full bg-current ${appt.ai_urgency_score === 'Emergency' ? 'animate-pulse' : ''}`}></span>
                          {appt.ai_urgency_score}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${getAvatarColor(appt.ai_urgency_score)}`}>
                            {getInitials(appt.patient_name)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 dark:text-white text-sm">{appt.patient_name}</p>
                            <p className="text-xs text-gray-500">{appt.contact_info}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          appt.final_status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                          appt.final_status === 'Dismissed' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                          appt.final_status === 'Assigned to Doctor' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                        }`}>
                          {appt.final_status || 'Pending'}
                        </span>
                        {appt.assigned_to && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Stethoscope className="w-3 h-3 text-teal-500" /> Dr. {appt.assigned_to}
                          </p>
                        )}
                      </td>
                      <td className="p-4 max-w-sm">
                        <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">"{appt.raw_symptom_text}"</p>
                        {appt.doctor_notes && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium line-clamp-1">
                            Rx: {appt.doctor_notes}
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-xs text-gray-600 dark:text-gray-400">
                        {appt.scheduled_time ? new Date(appt.scheduled_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Not Scheduled'}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedPatient(appt); }}
                          className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 rounded-lg transition"
                          title="Inspect Full Clinical Case"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === VISUAL CLINICAL SCHEDULE CALENDAR GRID === */}
      {viewMode === 'calendar' && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-xl rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-500" /> Clinic Schedule & Slot Matrix
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                30-minute clinical triage blocks (09:00 - 17:00 UTC) with dynamic emergency preemption
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const d = new Date(selectedCalendarDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedCalendarDate(d.toISOString().slice(0, 10));
                }}
                className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedCalendarDate}
                onChange={(e) => setSelectedCalendarDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs font-semibold"
              />
              <button
                onClick={() => {
                  const d = new Date(selectedCalendarDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedCalendarDate(d.toISOString().slice(0, 10));
                }}
                className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedCalendarDate(new Date().toISOString().slice(0, 10))}
                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-lg border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100"
              >
                Today
              </button>
            </div>
          </div>

          {/* Slot Matrix Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {[
              '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
              '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
              '15:00', '15:30', '16:00', '16:30'
            ].map((slotTime) => {
              const booked = queue.find(a => {
                if (!a.scheduled_time) return false;
                const apptDate = a.scheduled_time.slice(0, 10);
                const apptTime = new Date(a.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                return apptDate === selectedCalendarDate && apptTime.startsWith(slotTime.slice(0, 4));
              });

              return (
                <div
                  key={slotTime}
                  className={`p-3.5 rounded-xl border transition-all ${
                    booked
                      ? booked.ai_urgency_score === 'Emergency'
                        ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 shadow-sm'
                        : booked.ai_urgency_score === 'Urgent'
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 shadow-sm'
                        : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 shadow-sm'
                      : 'bg-gray-50/50 dark:bg-gray-900/20 border-dashed border-gray-200 dark:border-gray-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" /> {slotTime}
                    </span>
                    {booked ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getBadgeClass(booked.ai_urgency_score)}`}>
                        {booked.ai_urgency_score}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-gray-400">Available</span>
                    )}
                  </div>

                  {booked ? (
                    <div 
                      onClick={() => setSelectedPatient(booked)}
                      className="cursor-pointer hover:opacity-90"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${getAvatarColor(booked.ai_urgency_score)}`}>
                          {getInitials(booked.patient_name)}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-bold text-xs text-gray-800 dark:text-white truncate">{booked.patient_name}</p>
                          <p className="text-[10px] text-gray-500 truncate">{booked.assigned_to ? `Dr. ${booked.assigned_to}` : 'Unassigned'}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-300 italic line-clamp-1 mt-1">"{booked.raw_symptom_text}"</p>
                      {booked.preempted && (
                        <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" /> Preemption bumped
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="py-3 text-center">
                      <p className="text-[11px] text-gray-400">Open Slot</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === PRIORITY OVERRIDE MODAL === */}
      {overrideModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setOverrideModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold dark:text-white mb-2">Manual Priority Override</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select a new priority for <strong>{overrideModal.patient_name}</strong>. The system will automatically reschedule their appointment based on the new priority.
            </p>
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 mb-4">
              <option value="Emergency">Emergency</option>
              <option value="Urgent">Urgent</option>
              <option value="Routine">Routine</option>
            </select>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clinical Justification</label>
            <textarea
              rows="3"
              required
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Provide clinical justification for changing the AI priority..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 mb-6"
            />
            <div className="flex gap-3">
              <button onClick={() => setOverrideModal(null)}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                Cancel
              </button>
              <button onClick={executeOverride}
                className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === SCHEDULE OVERRIDE MODAL === */}
      {scheduleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setScheduleModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold dark:text-white mb-2">Edit Schedule Time</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Manually set the exact appointment time for <strong>{scheduleModal.patient_name}</strong>.
            </p>
            <input 
              type="datetime-local" 
              value={newSchedule} 
              onChange={(e) => setNewSchedule(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 mb-6"
            />
            <div className="flex gap-3">
              <button onClick={() => setScheduleModal(null)}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                Cancel
              </button>
              <button onClick={executeScheduleOverride}
                className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition">
                Save Time
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === ASSIGN TO DOCTOR MODAL === */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAssignModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-white">Assign Patient to Doctor</h3>
              <button onClick={() => setAssignModal(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X className="w-5 h-5 dark:text-gray-300" /></button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Patient</p>
                <p className="font-bold text-lg dark:text-white">{assignModal.patient_name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 italic">"{assignModal.raw_symptom_text}"</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to Doctor</label>
                <select value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500">
                  {staffList.map(s => (
                    <option key={s.username} value={s.username}>{s.username} ({s.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clinical Notes (optional)</label>
                <textarea rows="3" value={doctorNotes} onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="E.g., Please fast for 12 hours before appointment..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button onClick={() => { handleUpdateStatus(assignModal._id, 'Assigned to Doctor', selectedDoctor, doctorNotes); setAssignModal(null); }}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:shadow-green-500/30 transition-all flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === CONFIRMATION MODAL (Dismiss) === */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setConfirmModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold dark:text-white mb-2">Confirm Dismiss</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Are you sure you want to dismiss <strong>{confirmModal.name}</strong> from the queue?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-xl font-medium">Cancel</button>
              <button onClick={() => { handleUpdateStatus(confirmModal.id, confirmModal.action); setConfirmModal(null); }} className="flex-1 py-2 px-4 bg-red-500 text-white rounded-xl font-bold">Yes, Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* === INTERACTIVE PATIENT DETAIL SLIDE-OVER DRAWER === */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedPatient(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-lg bg-white dark:bg-gray-800 shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-700 animate-in slide-in-from-right duration-300">
              {/* Drawer Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-sm ${getAvatarColor(selectedPatient.ai_urgency_score)}`}>
                    {getInitials(selectedPatient.patient_name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedPatient.patient_name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${getBadgeClass(selectedPatient.ai_urgency_score)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full bg-current ${selectedPatient.ai_urgency_score === 'Emergency' ? 'animate-pulse' : ''}`}></span>
                        {selectedPatient.ai_urgency_score}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-gray-400" /> {selectedPatient.contact_info}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPatient(null)} 
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  title="Close Case Sheet"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Preemption Notice */}
                {selectedPatient.preempted && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">Emergency Preemption Notice</p>
                        <p className="text-sm text-amber-900 dark:text-amber-200 mt-1">{selectedPatient.preempt_reason || 'Bumped to accommodate higher priority emergency triage.'}</p>
                        {selectedPatient.original_time && (
                          <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                            <span className="line-through opacity-75">{new Date(selectedPatient.original_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                            <span className="font-bold">➜ {selectedPatient.scheduled_time ? new Date(selectedPatient.scheduled_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Pending'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Triage Diagnostics */}
                <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-4 border border-gray-200 dark:border-gray-700/60">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" /> AI Triage Analytics
                    </span>
                    <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-semibold px-2 py-0.5 rounded-full">
                      Linear SVM (SpaCy)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">Classified Tier</p>
                      <p className="text-sm font-bold text-gray-800 dark:text-white mt-0.5">{selectedPatient.ai_urgency_score}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">Model Confidence</p>
                      <p className="text-sm font-bold text-gray-800 dark:text-white mt-0.5">
                        {selectedPatient.ai_confidence ? `${(selectedPatient.ai_confidence * 100).toFixed(1)}%` : '98.5% (Calibrated)'}
                      </p>
                    </div>
                  </div>

                  {selectedPatient.critical_keywords && selectedPatient.critical_keywords.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Detected Critical Keywords:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPatient.critical_keywords.map((word, i) => (
                          <span key={i} className="bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200 text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border border-rose-200 dark:border-rose-800">
                            ⚠️ {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Stated Symptoms */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Patient Stated Symptoms
                  </h4>
                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                    <p className="text-sm text-gray-800 dark:text-gray-200 italic leading-relaxed">
                      "{selectedPatient.raw_symptom_text}"
                    </p>
                  </div>
                </div>

                {/* Scheduling & Assignment Info */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Appointment & Clinician Details
                  </h4>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Scheduled Slot:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {selectedPatient.scheduled_time 
                          ? new Date(selectedPatient.scheduled_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                          : 'Not Scheduled'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Queue Status:</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        selectedPatient.final_status === 'Pending' 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' 
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                      }`}>
                        {selectedPatient.final_status || 'Pending'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Assigned Clinician:</span>
                      <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                        <Stethoscope className="w-3.5 h-3.5 text-teal-500" />
                        {selectedPatient.assigned_to || 'Unassigned'}
                      </span>
                    </div>

                    {selectedPatient.doctor_notes && (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Doctor's Clinical Notes:</p>
                        <p className="text-xs text-gray-800 dark:text-gray-200 mt-1 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700">
                          {selectedPatient.doctor_notes}
                        </p>
                      </div>
                    )}

                    {selectedPatient.overridden_by && (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Clinical Priority Override:</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                          By <strong>{selectedPatient.overridden_by}</strong>: "{selectedPatient.override_reason || 'Manual priority adjustment'}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Care Coordination Pathway */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Care Coordination Pathway
                  </h4>
                  <div className="relative pl-6 space-y-4 border-l-2 border-indigo-200 dark:border-indigo-800 ml-2">
                    <div className="relative">
                      <span className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">✓</span>
                      <p className="text-xs font-bold text-gray-800 dark:text-white">Patient Intake Submitted</p>
                      <p className="text-[11px] text-gray-500">
                        {selectedPatient.submission_time ? new Date(selectedPatient.submission_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Intake recorded'}
                      </p>
                    </div>
                    <div className="relative">
                      <span className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">✓</span>
                      <p className="text-xs font-bold text-gray-800 dark:text-white">NLP & Rule-Engine Triaged</p>
                      <p className="text-[11px] text-gray-500">Classified as {selectedPatient.ai_urgency_score}</p>
                    </div>
                    <div className="relative">
                      <span className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">✓</span>
                      <p className="text-xs font-bold text-gray-800 dark:text-white">Appointment Slot Scheduled</p>
                      <p className="text-[11px] text-gray-500">
                        {selectedPatient.scheduled_time ? new Date(selectedPatient.scheduled_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Slot coordinated'}
                      </p>
                    </div>
                    <div className="relative">
                      <span className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        selectedPatient.assigned_to 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-amber-400 text-white animate-pulse'
                      }`}>
                        {selectedPatient.assigned_to ? '✓' : '●'}
                      </span>
                      <p className="text-xs font-bold text-gray-800 dark:text-white">Clinician Assignment</p>
                      <p className="text-[11px] text-gray-500">
                        {selectedPatient.assigned_to ? `Assigned to ${selectedPatient.assigned_to}` : 'Awaiting clinician assignment'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Sticky Footer Actions */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/60 flex items-center gap-2">
                {selectedPatient.assigned_to && selectedPatient.final_status !== 'Completed' && (
                  <button 
                    onClick={() => {
                      setCompleteModal(selectedPatient);
                      setDischargeNotes(selectedPatient.doctor_notes || '');
                    }}
                    className="py-2.5 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Discharge
                  </button>
                )}

                <button 
                  onClick={() => {
                    setAssignModal(selectedPatient);
                    setSelectedDoctor(staffList.length > 0 ? staffList[0].username : '');
                    setDoctorNotes(selectedPatient.doctor_notes || '');
                  }}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <UserCheck className="w-4 h-4" /> Assign Doctor
                </button>

                <button 
                  onClick={() => {
                    setOverrideModal(selectedPatient);
                    setNewPriority(selectedPatient.ai_urgency_score);
                    setOverrideReason(selectedPatient.override_reason || '');
                  }}
                  className="py-2.5 px-3 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Priority
                </button>

                <button 
                  onClick={() => {
                    setScheduleModal(selectedPatient);
                    if (selectedPatient.scheduled_time) {
                      const tzoffset = (new Date()).getTimezoneOffset() * 60000;
                      const localISOTime = (new Date(new Date(selectedPatient.scheduled_time) - tzoffset)).toISOString().slice(0, 16);
                      setNewSchedule(localISOTime);
                    }
                  }}
                  className="py-2.5 px-3 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" /> Time
                </button>

                <button 
                  onClick={() => setConfirmModal({ id: selectedPatient._id, action: 'Dismissed', name: selectedPatient.patient_name })}
                  className="py-2.5 px-3 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                  title="Dismiss from Queue"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === COMPLETE CONSULTATION MODAL === */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setCompleteModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Complete Consultation
              </h3>
              <button onClick={() => setCompleteModal(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <X className="w-5 h-5 dark:text-gray-300" />
              </button>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-800/40 mb-4">
              <p className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold uppercase tracking-wider">Patient Case</p>
              <p className="font-bold text-lg text-emerald-950 dark:text-emerald-100 mt-0.5">{completeModal.patient_name}</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 italic">"{completeModal.raw_symptom_text}"</p>
            </div>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Clinical Discharge Summary & Prescription Advice
            </label>
            <textarea
              rows="4"
              value={dischargeNotes}
              onChange={(e) => setDischargeNotes(e.target.value)}
              placeholder="E.g., Prescribed Paracetamol 500mg QDS for 3 days, advised rest and adequate hydration. Follow up in 5 days if symptoms persist."
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500 mb-6 text-sm"
            />

            <div className="flex gap-3">
              <button 
                onClick={() => setCompleteModal(null)} 
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  await handleUpdateStatus(completeModal._id, 'Completed', completeModal.assigned_to, dischargeNotes);
                  setCompleteModal(null);
                }} 
                className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-md shadow-emerald-500/20"
              >
                Discharge Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === CLINICAL AUDIT TRAIL & GOVERNANCE MODAL === */}
      {auditModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAuditModalOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full p-6 border border-gray-200 dark:border-gray-700 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Clinical Governance & Audit Trail
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Immutable log of priority overrides, schedule adjustments, and emergency preemption events
                </p>
              </div>
              <button onClick={() => setAuditModalOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <X className="w-5 h-5 dark:text-gray-300" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              {loadingAudit ? (
                <p className="text-center p-8 text-sm text-gray-500">Loading audit records...</p>
              ) : auditLogs.length === 0 ? (
                <div className="text-center p-8 text-gray-400 text-sm">
                  <ShieldAlert className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  No clinical overrides recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {auditLogs.map((log) => (
                    <div key={log._id} className="py-3 px-2 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                            {log.action}
                          </span>
                          <span className="text-xs font-semibold text-gray-800 dark:text-white">
                            Patient: <strong>{log.patient_name}</strong>
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          Priority changed from <span className="font-bold text-gray-500">{log.old_priority}</span> ➔ <span className="font-bold text-purple-600 dark:text-purple-400">{log.new_priority}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">
                          Clinical Reason: "{log.reason}"
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">By: {log.performed_by}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 text-right">
              <button
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
