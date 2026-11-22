import { useState, useEffect } from 'react';
import PatientPortal from './PatientPortal';
import toast from 'react-hot-toast';
import { 
  Calendar, AlertTriangle, User, Users, Clock, CheckCircle2, 
  History, Activity, Search, X, Stethoscope, Pill, FileText, 
  ClipboardList 
} from 'lucide-react';
import { API_URL, WS_URL } from '../config';

// Universal Wall-Clock Time Parser & Display Helpers (No Timezone Shift)
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const formatAppointmentTime = (dateInput, style = 'full') => {
  if (!dateInput) return '';

  if (typeof dateInput === 'object' && !(dateInput instanceof Date)) {
    if (dateInput.scheduled_time) return formatAppointmentTime(dateInput.scheduled_time, style);
    if (dateInput.clinic_date && dateInput.clinic_slot) {
      return formatAppointmentTime(`${dateInput.clinic_date}T${dateInput.clinic_slot}`, style);
    }
    if (dateInput.submission_time) return formatAppointmentTime(dateInput.submission_time, style);
  }

  let year = '', month = '', day = '', hh = '00', mm = '00';

  if (typeof dateInput === 'string') {
    const match = dateInput.trim().match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
    if (match) {
      [, year, month, day, hh, mm] = match;
    } else {
      const dateOnly = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateOnly) {
        [, year, month, day] = dateOnly;
        hh = '09';
        mm = '00';
      }
    }
  }

  if (!year) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    year = String(d.getFullYear());
    month = String(d.getMonth() + 1).padStart(2, '0');
    day = String(d.getDate()).padStart(2, '0');
    hh = String(d.getHours()).padStart(2, '0');
    mm = String(d.getMinutes()).padStart(2, '0');
  }

  const hNum = parseInt(hh, 10);
  const ampm = hNum >= 12 ? 'PM' : 'AM';
  const h12 = hNum % 12 || 12;
  const h12Str = String(h12).padStart(2, '0');
  const timeStr = `${h12Str}:${mm} ${ampm}`;

  const mIdx = parseInt(month, 10) - 1;
  const fullMonth = MONTH_NAMES[mIdx] || month;
  const shortMonth = SHORT_MONTHS[mIdx] || month;
  const dNum = parseInt(day, 10);

  if (style === 'time') return timeStr;
  if (style === 'date') return `${fullMonth} ${dNum}, ${year}`;
  if (style === 'shortDate') return `${shortMonth} ${dNum}, ${year}`;
  if (style === 'medium' || style === 'short') return `${shortMonth} ${dNum}, ${year} at ${timeStr}`;
  return `${fullMonth} ${dNum}, ${year} at ${timeStr}`;
};

// Clean standard time display with zero timezone labels
export const renderScheduledTime = (dateInput, dateStyle = 'full') => {
  const formatted = formatAppointmentTime(dateInput, dateStyle);
  if (!formatted) return null;

  return (
    <span className="font-semibold text-gray-800 dark:text-gray-200">
      {formatted}
    </span>
  );
};

export default function PatientDashboard({ onLogout }) {
  const loggedInUser = localStorage.getItem('username') || '';
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [patientFilter, setPatientFilter] = useState('');

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get-queue`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 401) {
        if (onLogout) onLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setAppointments(data.queue || []);
      }
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      if (event.data === 'update') {
        fetchAppointments();
        toast('Your queue has been updated!', { icon: '🔔' });
      }
      if (event.data === 'emergency_preemption') {
        fetchAppointments();
        toast(
          'An emergency case has caused schedule changes. Please check your appointment times.',
          { icon: '🚨', duration: 8000, style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' } }
        );
      }
    };
    return () => ws.close();
  }, []);

  const getStatusStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('completed') || s.includes('resolved') || s.includes('discharged')) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
    }
    if (s === 'pending') {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    }
    if (s.includes('assigned')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
    }
    if (s.includes('progress')) {
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
  };

  const getUrgencyStyle = (urgency) => {
    switch (urgency) {
      case 'Emergency':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-300 dark:border-rose-800 font-bold';
      case 'Urgent':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-800 font-bold';
      case 'Routine':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 font-bold';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-700';
    }
  };

  // Classify active vs completed/discharged/resolved
  const isPastRecord = (appt) => {
    const s = (appt.final_status || '').toLowerCase().trim();
    return (
      s === 'completed' || 
      s === 'resolved' || 
      s === 'discharged' || 
      s === 'dismissed' ||
      s.includes('completed') ||
      s.includes('discharged') ||
      s.includes('resolved')
    );
  };

  // Structured parser for doctor's clinical consultation & discharge note
  const parseClinicalNotes = (notes) => {
    if (!notes) return { clinicalNote: '', prescriptions: [], vitals: [], labs: [], raw: '' };
    const raw = notes.trim();

    let clinicalNote = '';
    let prescriptions = [];
    let vitals = [];
    let labs = [];

    if (raw.includes('[CLINICAL') || raw.includes('[PRESCRIPTIONS') || raw.includes('[VITALS') || raw.includes('[TESTS')) {
      const vitalsMatch = raw.match(/\[VITALS(?: RECORDED)?\]\s*([\s\S]*?)(?=\[(?:CLINICAL|PRESCRIPTIONS|TESTS|DIAGNOSTIC)|$)/i);
      if (vitalsMatch && vitalsMatch[1].trim()) {
        vitals = vitalsMatch[1].trim().split('|').map(v => v.trim()).filter(Boolean);
      }

      const noteMatch = raw.match(/\[CLINICAL CONSULTATION NOTE\]\s*([\s\S]*?)(?=\[(?:PRESCRIPTIONS|TESTS|DIAGNOSTIC|VITALS)|$)/i);
      if (noteMatch && noteMatch[1].trim()) {
        clinicalNote = noteMatch[1].trim();
      } else {
        const cleanHeader = raw.replace(/\[CLINICAL CONSULTATION & DISCHARGE SUMMARY[^\]]*\]/i, '').trim();
        const firstSection = cleanHeader.split(/\[(?:VITALS|PRESCRIPTIONS|TESTS|DIAGNOSTIC)/i)[0];
        if (firstSection && firstSection.trim()) {
          clinicalNote = firstSection.replace(/Encounter Date\/Time:[^\n]*/i, '').trim();
        }
      }

      const rxMatch = raw.match(/\[PRESCRIPTIONS(?: ISSUED)?\]\s*([\s\S]*?)(?=\[(?:TESTS|DIAGNOSTIC|VITALS|CLINICAL)|$)/i);
      if (rxMatch && rxMatch[1].trim()) {
        prescriptions = rxMatch[1]
          .split('\n')
          .map(line => line.replace(/^[•\-*]\s*/, '').trim())
          .filter(Boolean);
      }

      const labsMatch = raw.match(/\[(?:TESTS & LABS ORDERED|DIAGNOSTIC ORDERS)\]\s*([\s\S]*?)(?=\[(?:PRESCRIPTIONS|VITALS|CLINICAL)|$)/i);
      if (labsMatch && labsMatch[1].trim()) {
        labs = labsMatch[1]
          .split('\n')
          .map(line => line.replace(/^[•\-*]\s*/, '').trim())
          .filter(Boolean);
      }
    } else {
      clinicalNote = raw;
    }

    return { clinicalNote, prescriptions, vitals, labs, raw };
  };

  const activeAppointments = appointments.filter(a => !isPastRecord(a));
  const pastAppointments = appointments.filter(a => isPastRecord(a));

  // Distinct patient names for quick filtering
  const uniquePatients = Array.from(
    new Set(
      appointments
        .map(a => (a.patient_name || a.username || '').trim())
        .filter(Boolean)
    )
  );

  const filterByPatient = (list) => {
    if (!patientFilter.trim()) return list;
    const q = patientFilter.trim().toLowerCase();
    return list.filter(appt => {
      const pName = (appt.patient_name || '').toLowerCase();
      const uName = (appt.username || '').toLowerCase();
      return pName.includes(q) || uName.includes(q);
    });
  };

  const displayedActive = filterByPatient(activeAppointments);
  const displayedPast = filterByPatient(pastAppointments);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 mt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold dark:text-white text-gray-800">My Patient Dashboard</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage consultations, schedule new symptoms, and access clinical records.
          </p>
        </div>
        {loggedInUser && (
          <div className="flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm text-xs text-gray-600 dark:text-gray-300">
            <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Account: <strong className="text-gray-900 dark:text-white">@{loggedInUser}</strong></span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Symptom Intake Form */}
        <div className="lg:col-span-5">
          <div className="sticky top-6">
            <h3 className="text-xl font-bold mb-4 dark:text-gray-200 text-gray-700 flex items-center gap-2">
              <span>Submit New Symptoms</span>
            </h3>
            <PatientPortal onAppointmentCreated={fetchAppointments} />
          </div>
        </div>

        {/* Right Column: Appointments & History Tabs */}
        <div className="lg:col-span-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-xl font-bold dark:text-gray-200 text-gray-700">
              My Appointments &amp; History
            </h3>

            {/* View Switching Tabs */}
            <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-800/90 rounded-xl border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'active'
                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Active &amp; Scheduled</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'active'
                    ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}>
                  {activeAppointments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'history'
                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History &amp; Past Records</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'history'
                    ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}>
                  {pastAppointments.length}
                </span>
              </button>
            </div>
          </div>

          {/* Search Filter Bar (Active whenever appointments exist) */}
          {appointments.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={patientFilter}
                  onChange={(e) => setPatientFilter(e.target.value)}
                  placeholder="Filter by patient name (e.g. Amina, Rayan, Tashfiq)..."
                  className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                />
                {patientFilter && (
                  <button
                    type="button"
                    onClick={() => setPatientFilter('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    title="Clear filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Patient Filter Chips if multiple family members exist */}
              {uniquePatients.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mr-1 flex items-center gap-1">
                    <Users className="w-3 h-3 text-indigo-500" />
                    Family:
                  </span>
                  <button
                    type="button"
                    onClick={() => setPatientFilter('')}
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-all ${
                      patientFilter === ''
                        ? 'bg-indigo-600 text-white font-bold shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    All ({activeTab === 'active' ? activeAppointments.length : pastAppointments.length})
                  </button>
                  {uniquePatients.map((name) => {
                    const isSelected = patientFilter.toLowerCase() === name.toLowerCase();
                    const countInTab = (activeTab === 'active' ? activeAppointments : pastAppointments)
                      .filter(a => ((a.patient_name || a.username || '').toLowerCase() === name.toLowerCase())).length;

                    return (
                      <button
                        type="button"
                        key={name}
                        onClick={() => setPatientFilter(name)}
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-bold shadow-sm'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <User className="w-3 h-3" />
                        <span>{name}</span>
                        <span className={`text-[10px] px-1.5 rounded-full ${isSelected ? 'bg-indigo-700 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                          {countInTab}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 1: Active & Scheduled Appointments */}
          {activeTab === 'active' && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
              {loading ? (
                <div className="p-12 text-center text-gray-500">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm">Loading active appointments...</p>
                </div>
              ) : activeAppointments.length === 0 ? (
                <div className="p-12 text-center">
                  <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-gray-700 dark:text-gray-300 mb-1">No Active Appointments</h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    You currently have no scheduled or ongoing consultations. Submit symptoms on the left to schedule a new visit.
                  </p>
                </div>
              ) : displayedActive.length === 0 ? (
                <div className="p-10 text-center">
                  <Search className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    No active appointments found for "{patientFilter}"
                  </p>
                  <button
                    type="button"
                    onClick={() => setPatientFilter('')}
                    className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                  >
                    Clear search filter
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {displayedActive.map(appt => {
                    const patientDisplayName = appt.patient_name || appt.username || 'Patient';
                    const isBookedForOther = Boolean(
                      loggedInUser && 
                      appt.patient_name && 
                      appt.patient_name.trim().toLowerCase() !== loggedInUser.trim().toLowerCase()
                    );

                    return (
                      <li key={appt._id} className="p-6 transition-all hover:bg-gray-50/50 dark:hover:bg-gray-750/30">
                        {/* Prominent Patient Header with User icon & Badge */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-gray-100 dark:border-gray-700/60">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-gray-900 dark:text-white">
                                  {patientDisplayName}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                                  <User className="w-2.5 h-2.5" />
                                  Patient
                                </span>
                              </div>
                              {isBookedForOther && (
                                <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-medium border border-slate-200 dark:border-slate-600">
                                    Booked by @{appt.username || loggedInUser}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getUrgencyStyle(appt.ai_urgency_score)}`}>
                              {appt.ai_urgency_score || 'Routine'}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusStyle(appt.final_status)}`}>
                              {appt.final_status}
                            </span>
                          </div>
                        </div>

                        {/* Scheduled Appointment Date/Time */}
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                          <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                          {appt.scheduled_time ? (
                            renderScheduledTime(appt.scheduled_time, 'full')
                          ) : (
                            <span>Submitted: {formatAppointmentTime(appt.submission_time, 'medium')}</span>
                          )}
                        </div>

                        {/* Symptoms Summary */}
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 mb-3 italic">
                          "{appt.raw_symptom_text}"
                        </div>

                        {/* Emergency Preemption Warning Alert */}
                        {appt.preempted && (
                          <div className="mt-3 p-4 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-200 dark:border-amber-800">
                            <div className="flex items-start gap-2 mb-3">
                              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                                  Schedule Changed — Emergency Preemption
                                </p>
                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                  {appt.preempt_reason}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                              {appt.original_time && (
                                <div className="flex-1 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-2.5">
                                  <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">❌ Previous</p>
                                  <div className="text-xs text-red-700 dark:text-red-300 line-through mt-0.5">
                                    {renderScheduledTime(appt.original_time, 'medium')}
                                  </div>
                                </div>
                              )}
                              <div className="flex-1 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-2.5">
                                <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">✅ New Time</p>
                                <div className="text-xs text-green-700 dark:text-green-300 font-bold mt-0.5">
                                  {renderScheduledTime(appt.scheduled_time, 'medium')}
                                </div>
                              </div>
                            </div>
                            <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-2 italic">
                              An email and/or SMS notification has been sent. Contact the clinic if this time doesn't work.
                            </p>
                          </div>
                        )}

                        {/* Doctor Assignment Details */}
                        {appt.assigned_to && (
                          <div className="mt-3 p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/60">
                            <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                              <Stethoscope className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              Assigned Attending: <strong>Dr. {appt.assigned_to}</strong>
                            </p>
                            {appt.doctor_notes && (
                              <p className="text-xs text-blue-800 dark:text-blue-400 mt-1 italic pl-5">
                                "{appt.doctor_notes}"
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Tab 2: History & Past Records */}
          {activeTab === 'history' && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
              {loading ? (
                <div className="p-12 text-center text-gray-500">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm">Loading consultation history...</p>
                </div>
              ) : pastAppointments.length === 0 ? (
                <div className="p-12 text-center">
                  <History className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-gray-700 dark:text-gray-300 mb-1">No Past Consultation Records</h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Previous consultations, discharge notes, prescriptions, and completed visits will appear archived here.
                  </p>
                </div>
              ) : displayedPast.length === 0 ? (
                <div className="p-10 text-center">
                  <Search className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    No past records found for "{patientFilter}"
                  </p>
                  <button
                    type="button"
                    onClick={() => setPatientFilter('')}
                    className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                  >
                    Clear search filter
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {displayedPast.map(appt => {
                    const patientDisplayName = appt.patient_name || appt.username || 'Patient';
                    const isBookedForOther = Boolean(
                      loggedInUser && 
                      appt.patient_name && 
                      appt.patient_name.trim().toLowerCase() !== loggedInUser.trim().toLowerCase()
                    );
                    const parsed = parseClinicalNotes(appt.doctor_notes);
                    const completedDate = appt.updated_at || appt.completed_at || appt.scheduled_time || appt.submission_time;

                    return (
                      <li key={appt._id} className="p-6 transition-all hover:bg-gray-50/50 dark:hover:bg-gray-750/30">
                        {/* Prominent Patient Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-gray-100 dark:border-gray-700/60">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-gray-900 dark:text-white">
                                  {patientDisplayName}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                  <User className="w-2.5 h-2.5" />
                                  Patient
                                </span>
                              </div>
                              {isBookedForOther && (
                                <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-medium border border-slate-200 dark:border-slate-600">
                                    Booked by @{appt.username || loggedInUser}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              {appt.final_status || 'Completed'}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getUrgencyStyle(appt.ai_urgency_score)}`}>
                              {appt.ai_urgency_score || 'Routine'}
                            </span>
                          </div>
                        </div>

                        {/* Consultation Meta Info: Date Completed & Attending Doctor */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300 mb-3 bg-gray-50/70 dark:bg-gray-900/40 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>
                              <strong>Date Completed:</strong> {completedDate ? (
                                <span className="font-semibold text-gray-800 dark:text-gray-200">
                                  {formatAppointmentTime(completedDate, 'medium')}
                                </span>
                              ) : 'Recorded'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span>
                              <strong>Attending Doctor:</strong> Dr. {appt.assigned_to || 'Assigned Physician'}
                            </span>
                          </div>
                        </div>

                        {/* Symptoms Presented */}
                        <div className="text-xs mb-3 text-gray-600 dark:text-gray-300">
                          <span className="font-semibold text-gray-700 dark:text-gray-200">Presented Symptoms:</span>
                          <p className="mt-0.5 italic bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                            "{appt.raw_symptom_text}"
                          </p>
                        </div>

                        {/* Vitals Recorded (if any) */}
                        {parsed.vitals.length > 0 && (
                          <div className="mb-3">
                            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider block mb-1">
                              Recorded Vitals
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {parsed.vitals.map((v, idx) => (
                                <span key={idx} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  {v}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Clinical Consultation & Discharge Notes */}
                        {parsed.clinicalNote ? (
                          <div className="mb-3 p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1">
                              <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Clinical Consultation &amp; Discharge Summary</span>
                            </div>
                            <p className="text-xs text-indigo-950 dark:text-indigo-200 whitespace-pre-wrap leading-relaxed">
                              {parsed.clinicalNote}
                            </p>
                          </div>
                        ) : null}

                        {/* Prescriptions Suite */}
                        <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/60">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-1.5">
                            <Pill className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Prescriptions &amp; Medication Orders</span>
                          </div>
                          {parsed.prescriptions.length > 0 ? (
                            <ul className="space-y-1.5">
                              {parsed.prescriptions.map((rx, idx) => (
                                <li key={idx} className="text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2 bg-white/70 dark:bg-gray-800/70 px-2.5 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">•</span>
                                  <span className="font-medium">{rx}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 italic">
                              No prescription medications ordered during this consultation.
                            </p>
                          )}
                        </div>

                        {/* Diagnostic Tests / Lab Orders if any */}
                        {parsed.labs.length > 0 && (
                          <div className="mt-3 p-3 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/50">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900 dark:text-purple-300 mb-1">
                              <ClipboardList className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span>Diagnostic Orders &amp; Tests</span>
                            </div>
                            <ul className="space-y-1">
                              {parsed.labs.map((order, idx) => (
                                <li key={idx} className="text-xs text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                  <span>{order}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
