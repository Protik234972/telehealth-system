import { useState, useEffect } from 'react';
import { Search, Filter, UserCheck, XCircle, X, Send, Edit2, Calendar, AlertTriangle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL, WS_URL } from '../config';

export default function Dashboard({ onLogout }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  // Modals State
  const [assignModal, setAssignModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [overrideModal, setOverrideModal] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(null);
  
  // Assignment Form State
  const [staffList, setStaffList] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');

  // Override Form State
  const [newPriority, setNewPriority] = useState('');
  const [newSchedule, setNewSchedule] = useState('');

  // Preemption Events State
  const [preemptionEvents, setPreemptionEvents] = useState([]);
  const [showPreemptionBanner, setShowPreemptionBanner] = useState(false);

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

  useEffect(() => {
    fetchQueue();
    fetchStaffList();
    fetchPreemptionLog();
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      if (event.data === 'update') fetchQueue();
      if (event.data === 'emergency_preemption') {
        fetchQueue();
        fetchPreemptionLog();
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
    try {
      const response = await fetch(`${API_URL}/override-priority/${overrideModal._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ new_priority: newPriority })
      });
      if (response.ok) {
        toast.success(`Priority overridden to ${newPriority}`);
        setOverrideModal(null);
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
      case 'Emergency': return 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200 animate-pulse';
      case 'Urgent': return 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200';
      case 'Routine': return 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const filteredQueue = queue.filter(appt => {
    const matchesSearch = appt.patient_name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' || appt.ai_urgency_score === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="w-full max-w-7xl mx-auto p-6 mt-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
            Live Coordinator Dashboard
          </h2>
          <div className="flex items-center space-x-2 mt-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Real-time WebSocket Connected</span>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Search patients..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}
              className="pl-10 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 appearance-none bg-white dark:bg-gray-700">
              <option value="All">All Priorities</option>
              <option value="Emergency">Emergency</option>
              <option value="Urgent">Urgent</option>
              <option value="Routine">Routine</option>
            </select>
          </div>
        </div>
      </div>

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

      {/* Queue Table */}
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
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No pending appointments found.</td></tr>
              ) : (
                filteredQueue.map((appt) => (
                  <tr key={appt._id} className={`transition-all duration-300 ${getRowClass(appt.ai_urgency_score)}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1 ${getBadgeClass(appt.ai_urgency_score)}`}>
                          {appt.ai_urgency_score}
                        </span>
                        <button onClick={() => { setOverrideModal(appt); setNewPriority(appt.ai_urgency_score); }}
                          className="text-gray-400 hover:text-blue-500 transition" title="Manual Override">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                      {appt.overridden_by && (
                        <p className="text-[10px] text-gray-500 mt-1 italic">Overridden by {appt.overridden_by}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-gray-800 dark:text-white">{appt.patient_name}</p>
                      <p className="text-sm opacity-80 dark:text-gray-300">{appt.contact_info}</p>
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
                        <button onClick={() => { 
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
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setAssignModal(appt); setSelectedDoctor(staffList.length > 0 ? staffList[0].username : ''); setDoctorNotes(''); }}
                          className="p-2 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50 rounded-lg transition" title="Assign to Doctor">
                          <UserCheck className="w-5 h-5" />
                        </button>
                        <button onClick={() => setConfirmModal({ id: appt._id, action: 'Dismissed', name: appt.patient_name })}
                          className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition" title="Dismiss">
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* === PRIORITY OVERRIDE MODAL === */}
      {overrideModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setOverrideModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold dark:text-white mb-2">Manual Priority Override</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select a new priority for <strong>{overrideModal.patient_name}</strong>. The system will automatically reschedule their appointment based on the new priority.
            </p>
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 mb-6">
              <option value="Emergency">Emergency</option>
              <option value="Urgent">Urgent</option>
              <option value="Routine">Routine</option>
            </select>
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
    </div>
  );
}
