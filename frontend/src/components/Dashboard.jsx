import { useState, useEffect } from 'react';
import { 
  Search, Filter, UserCheck, XCircle, X, Send, Edit2, Calendar, 
  AlertTriangle, Zap, Users, Activity, Clock, Stethoscope, Eye, 
  FileText, CheckCircle2, ChevronRight, ChevronLeft, Phone, User, 
  Download, ShieldAlert, History, CalendarDays, LayoutGrid, Check, 
  Heart, Thermometer, Pill, Sparkles, ClipboardList, RefreshCw, 
  ArrowRight, UserPlus, FileCheck, ArrowUpRight 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL, WS_URL } from '../config';

export default function Dashboard({ onLogout }) {
  const [queue, setQueue] = useState(() => {
    try {
      const cached = sessionStorage.getItem('teletriage_queue');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const cached = sessionStorage.getItem('teletriage_queue');
      return cached ? false : true;
    } catch (e) {
      return true;
    }
  });
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  // Real-time interval ticker for countdown timer
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // View & Mode State
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'calendar'
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date().toISOString().slice(0, 10));

  // Admin All Records Archive State
  const [archiveList, setArchiveList] = useState(() => {
    try {
      const cached = sessionStorage.getItem('teletriage_archive');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [archiveStatusFilter, setArchiveStatusFilter] = useState('All');

  // Clinical Audit Trail State
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // General Modals & Drawer State
  const [selectedPatient, setSelectedPatient] = useState(null);
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
  const [overrideReason, setOverrideReason] = useState('');
  const [newSchedule, setNewSchedule] = useState('');

  // Preemption Events State
  const [preemptionEvents, setPreemptionEvents] = useState([]);
  const [showPreemptionBanner, setShowPreemptionBanner] = useState(false);

  // Dedicated Clinical Encounter Suite State (Doctor View)
  const [encounterPatient, setEncounterPatient] = useState(null);
  const [encounterVitals, setEncounterVitals] = useState({
    bp: '',
    hr: '',
    spo2: '',
    temp: '',
    rr: ''
  });
  const [clinicalNote, setClinicalNote] = useState('');
  const [rxNotes, setRxNotes] = useState('');
  const [selectedLabOrders, setSelectedLabOrders] = useState([]);

  const userRole = localStorage.getItem('role') || 'staff';
  const getStoredUsername = () => {
    const saved = localStorage.getItem('username');
    if (saved && saved.trim()) return saved.trim();
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.sub) {
            localStorage.setItem('username', payload.sub);
            return payload.sub;
          }
        }
      }
    } catch (e) {}
    return '';
  };
  const currentUsername = getStoredUsername() || 'doctor_bob';
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
      try {
        sessionStorage.setItem('teletriage_queue', JSON.stringify(data.queue));
      } catch (e) {}
      setArchiveList(prev => {
        const map = new Map();
        prev.forEach(item => map.set(item._id, item));
        data.queue.forEach(item => {
          const existing = map.get(item._id);
          map.set(item._id, { ...existing, ...item });
        });
        const list = Array.from(map.values());
        try {
          sessionStorage.setItem('teletriage_archive', JSON.stringify(list));
        } catch (e) {}
        return list;
      });
      setSelectedPatient(prev => {
        if (!prev) return null;
        return data.queue.find(a => a._id === prev._id) || null;
      });
      setEncounterPatient(prev => {
        if (!prev) return null;
        return data.queue.find(a => a._id === prev._id) || prev;
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
        if (data.appointments && Array.isArray(data.appointments)) {
          setArchiveList(prev => {
            const map = new Map();
            prev.forEach(item => map.set(item._id, item));
            data.appointments.forEach(item => map.set(item._id, item));
            const list = Array.from(map.values());
            try {
              sessionStorage.setItem('teletriage_archive', JSON.stringify(list));
            } catch (e) {}
            return list;
          });
          return;
        }
      }
    } catch (err) {
      console.warn('Live backend archive fallback', err);
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
        setTimeout(() => setShowPreemptionBanner(false), 15000);
      }
    };
    return () => ws.close();
  }, []);

  const handleUpdateStatus = async (id, status, assigned_to = null, notes = null) => {
    try {
      const backendStatus = status === 'Assigned to Doctor' ? 'Pending' : status;
      const body = { status: backendStatus };
      if (assigned_to !== undefined && assigned_to !== null) body.assigned_to = assigned_to;
      if (notes !== undefined && notes !== null) body.doctor_notes = notes;

      const response = await fetch(`${API_URL}/update-status/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        if (status === 'Dismissed') {
          toast.success('Patient dismissed');
        } else if (status === 'Completed') {
          toast.success('Consultation completed and patient discharged');
        } else if (assigned_to) {
          toast.success(`Patient assigned to Dr. ${assigned_to}. Notification sent.`);
        } else {
          toast.success('Status updated successfully');
        }

        setQueue(prev => prev.map(a => a._id === id ? {
          ...a,
          final_status: backendStatus,
          assigned_to: assigned_to !== null ? assigned_to : a.assigned_to,
          doctor_notes: notes !== null ? notes : a.doctor_notes
        } : a));

        setArchiveList(prev => {
          const updated = prev.map(a => a._id === id ? {
            ...a,
            final_status: status === 'Assigned to Doctor' ? 'Assigned' : status,
            assigned_to: assigned_to !== null ? assigned_to : a.assigned_to,
            doctor_notes: notes !== null ? notes : a.doctor_notes
          } : a);
          if (!updated.some(a => a._id === id)) {
            const appt = queue.find(a => a._id === id);
            if (appt) {
              updated.unshift({
                ...appt,
                final_status: status === 'Assigned to Doctor' ? 'Assigned' : status,
                assigned_to: assigned_to !== null ? assigned_to : appt.assigned_to,
                doctor_notes: notes !== null ? notes : appt.doctor_notes
              });
            }
          }
          return updated;
        });

        await Promise.all([fetchQueue(), fetchArchive()]);
        return true;
      } else {
        toast.error('Failed to update status');
        return false;
      }
    } catch (err) {
      toast.error('Network error');
      return false;
    }
  };

  const executeOverride = async () => {
    if (!newPriority || !overrideModal) return;
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
      if (!response.ok) {
        toast.error('Failed to override priority');
        return;
      }

      const CLINIC_SLOTS = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
        '15:00', '15:30', '16:00', '16:30'
      ];

      let targetDateStr = selectedCalendarDate;
      if (overrideModal.scheduled_time) {
        const d = new Date(overrideModal.scheduled_time);
        if (!isNaN(d.getTime())) {
          targetDateStr = d.toISOString().slice(0, 10);
        }
      }

      const allAppts = queue.length > 0 ? [...queue] : [...archiveList];
      const sameDayAppts = allAppts.filter(a => {
        if (!a.scheduled_time) return true;
        const d = new Date(a.scheduled_time);
        if (isNaN(d.getTime())) return true;
        return d.toISOString().slice(0, 10) === targetDateStr;
      });

      const updatedList = sameDayAppts.map(a => 
        a._id === overrideModal._id ? { ...a, ai_urgency_score: newPriority, isNewlyEscalated: true } : a
      );

      const existingEmergencies = updatedList
        .filter(a => a.ai_urgency_score === 'Emergency' && !a.isNewlyEscalated)
        .sort((a, b) => new Date(a.scheduled_time || 0) - new Date(b.scheduled_time || 0));

      const newEmergencies = updatedList.filter(a => a.ai_urgency_score === 'Emergency' && a.isNewlyEscalated);

      const urgents = updatedList
        .filter(a => a.ai_urgency_score === 'Urgent')
        .sort((a, b) => new Date(a.scheduled_time || 0) - new Date(b.scheduled_time || 0));

      const routines = updatedList
        .filter(a => a.ai_urgency_score === 'Routine')
        .sort((a, b) => new Date(a.scheduled_time || 0) - new Date(b.scheduled_time || 0));

      const cascadedQueue = [...existingEmergencies, ...newEmergencies, ...urgents, ...routines];

      const slotUpdates = [];
      cascadedQueue.forEach((appt, idx) => {
        if (idx < CLINIC_SLOTS.length) {
          const slot = CLINIC_SLOTS[idx];
          const newIso = `${targetDateStr}T${slot}:00.000Z`;
          slotUpdates.push({ id: appt._id, new_time: newIso, slot });
        }
      });

      await Promise.all(slotUpdates.map(u => 
        fetch(`${API_URL}/override-schedule/${u.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
          body: JSON.stringify({ new_time: u.new_time })
        }).catch(e => console.warn('Schedule sync warning:', e))
      ));

      const assignedSlot = slotUpdates.find(u => u.id === overrideModal._id)?.slot || 'first available';
      if (newPriority === 'Emergency') {
        toast.success(`Emergency prioritized! Allocated slot ${assignedSlot}; subsequent slots shifted.`);
      } else {
        toast.success(`Priority updated to ${newPriority}. Schedule realigned.`);
      }

      setOverrideModal(null);
      setOverrideReason('');
      await fetchQueue();
    } catch (err) {
      console.error('Priority override error:', err);
      toast.error('Network error during priority override');
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

  // Visual helper styles
  const getRowClass = (urgency) => {
    switch(urgency) {
      case 'Emergency': return 'bg-red-50/70 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border-l-4 border-red-500';
      case 'Urgent': return 'bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 border-l-4 border-amber-500';
      case 'Routine': return 'bg-green-50/70 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-900/40 border-l-4 border-green-500';
      default: return 'bg-white dark:bg-gray-800 hover:bg-gray-50 border-l-4 border-gray-300';
    }
  };

  const getBadgeClass = (urgency) => {
    switch(urgency) {
      case 'Emergency': return 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200 ring-1 ring-rose-300 dark:ring-rose-700 font-bold';
      case 'Urgent': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 ring-1 ring-amber-300 dark:ring-amber-700 font-bold';
      case 'Routine': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 ring-1 ring-emerald-300 dark:ring-emerald-700 font-bold';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getAvatarColor = (urgency) => {
    switch(urgency) {
      case 'Emergency': return 'bg-rose-500 text-white shadow-rose-500/20';
      case 'Urgent': return 'bg-amber-500 text-white shadow-amber-500/20';
      case 'Routine': return 'bg-emerald-500 text-white shadow-emerald-500/20';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  };

  // Case ownership logic
  const isMyCase = (appt) => {
    if (!appt.assigned_to) return false;
    const a = appt.assigned_to.trim().toLowerCase();
    const u = (currentUsername || 'doctor_bob').trim().toLowerCase();
    return (
      a === u || 
      a.includes(u) || 
      u.includes(a) || 
      a === `dr. ${u}` || 
      `dr. ${a}` === u || 
      a === 'doctor_bob' || 
      a === 'dr. bob' || 
      (u === 'doctor_bob' && a.includes('bob')) ||
      a === 'staff'
    );
  };

  const isAssigned = (appt) => {
    return appt.final_status === 'Assigned to Doctor' || Boolean(appt.assigned_to);
  };

  const isUnassigned = (appt) => {
    return !isAssigned(appt) && appt.final_status !== 'Completed' && appt.final_status !== 'Dismissed';
  };

  // Live countdown timer calculation
  const getAppointmentCountdown = (scheduledTime, nowTime) => {
    if (!scheduledTime) {
      return { 
        text: 'Immediate / Walk-in', 
        badge: 'Intake Queued', 
        color: 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800'
      };
    }
    const target = new Date(scheduledTime).getTime();
    if (isNaN(target)) {
      return { 
        text: 'Time Unspecified', 
        badge: 'Pending', 
        color: 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      };
    }
    const diffMs = target - nowTime;
    const diffMinutes = Math.round(diffMs / 60000);

    if (diffMinutes > 60) {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return { 
        text: `In ${hours}h ${mins > 0 ? `${mins}m` : ''}`, 
        badge: 'Scheduled', 
        color: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
      };
    } else if (diffMinutes > 0) {
      return { 
        text: `In ${diffMinutes}m`, 
        badge: 'Starts Soon', 
        color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 animate-pulse font-semibold'
      };
    } else if (diffMinutes >= -60) {
      return { 
        text: `Due Now (${Math.abs(diffMinutes)}m ago)`, 
        badge: 'In Session', 
        color: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 animate-pulse font-bold'
      };
    } else {
      const hoursAgo = Math.abs(Math.round(diffMinutes / 60));
      return { 
        text: `${hoursAgo}h ago`, 
        badge: 'Past Window', 
        color: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      };
    }
  };

  // Consultation readiness assessment
  const getConsultationReadiness = (appt) => {
    if (appt.final_status === 'Completed') {
      return { 
        label: 'Discharged & Completed', 
        color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700', 
        dot: 'bg-emerald-500' 
      };
    }
    if (appt.doctor_notes && (appt.doctor_notes.includes('[CLINICAL') || appt.doctor_notes.includes('[VITALS'))) {
      return { 
        label: 'Encounter In-Progress', 
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-300 dark:border-blue-700', 
        dot: 'bg-blue-500 animate-pulse' 
      };
    }
    if (appt.ai_urgency_score === 'Emergency') {
      return { 
        label: 'Stat Attention Required', 
        color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border border-rose-300 dark:border-rose-700 animate-pulse', 
        dot: 'bg-rose-500 animate-ping' 
      };
    }
    if (appt.ai_urgency_score === 'Urgent') {
      return { 
        label: 'Triage Verified • Priority', 
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700', 
        dot: 'bg-amber-500' 
      };
    }
    return { 
      label: 'Triage Complete • Ready for Consult', 
      color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 border border-teal-300 dark:border-teal-700', 
      dot: 'bg-teal-500' 
    };
  };

  // Prescriptions Presets
  const COMMON_PRESCRIPTIONS = [
    { label: 'Paracetamol', dosage: 'Paracetamol 500mg PO Q4-6H PRN pain/fever (Max 4g/24h)' },
    { label: 'Amoxicillin', dosage: 'Amoxicillin 500mg PO TID x 7 days' },
    { label: 'Ibuprofen', dosage: 'Ibuprofen 400mg PO TID with meals x 5 days' },
    { label: 'Albuterol', dosage: 'Albuterol Inhaler 90mcg 2 puffs inhaled Q4-6H PRN wheezing' },
    { label: 'Azithromycin', dosage: 'Azithromycin 250mg PO: 500mg Day 1, then 250mg Days 2-5' },
    { label: 'Omeprazole', dosage: 'Omeprazole 20mg PO QD before breakfast x 14 days' },
    { label: 'Ondansetron', dosage: 'Ondansetron 4mg ODT Q8H PRN severe nausea' },
    { label: 'Oral Rehydration', dosage: 'Oral Rehydration Salts (ORS) 1 sachet in 200ml water PO PRN' }
  ];

  // Common Laboratory & Diagnostic Orders
  const COMMON_LAB_ORDERS = [
    'Complete Blood Count (CBC)',
    'Basic Metabolic Panel (BMP)',
    '12-Lead Electrocardiogram (ECG)',
    'Chest X-Ray (CXR - 2 Views)',
    'Urinalysis Dipstick & Micro',
    'Rapid Strep A / Flu / COVID Swab',
    'High-Sensitivity Troponin I',
    'Serum Lipase & Amylase'
  ];

  // Open Clinical Encounter Modal
  const openClinicalEncounter = (patient) => {
    setEncounterPatient(patient);

    // Clean Manual Vitals Entry - No mock/dummy vitals generation
    let bp = '';
    let hr = '';
    let spo2 = '';
    let temp = '';
    let rr = '';

    const existing = patient.doctor_notes || '';
    if (existing.includes('[VITALS')) {
      const bpMatch = existing.match(/BP:\s*([\d/]+)/i);
      const hrMatch = existing.match(/HR:\s*(\d+)/i);
      const spo2Match = existing.match(/SpO2:\s*(\d+)/i);
      const tempMatch = existing.match(/Temp:\s*([\d.]+)/i);
      const rrMatch = existing.match(/RR:\s*(\d+)/i);
      if (bpMatch) bp = bpMatch[1];
      if (hrMatch) hr = hrMatch[1];
      if (spo2Match) spo2 = spo2Match[1];
      if (tempMatch) temp = tempMatch[1];
      if (rrMatch) rr = rrMatch[1];
    }
    setEncounterVitals({ bp, hr, spo2, temp, rr });

    // Doctor's Clinical Consultation Note
    let note = '';
    if (existing) {
      if (existing.includes('[CLINICAL CONSULTATION NOTE]')) {
        const parts = existing.split('[CLINICAL CONSULTATION NOTE]');
        if (parts[1]) {
          const rest = parts[1].split(/\[PRESCRIPTIONS\]|\[TESTS & LABS ORDERED\]/)[0];
          note = rest.trim();
        }
      } else if (!existing.includes('[CLINICAL ENCOUNTER') && !existing.includes('[CLINICAL CONSULTATION')) {
        note = existing;
      }
    }
    setClinicalNote(note);

    // Prescriptions Suite
    let rx = '';
    if (existing.includes('[PRESCRIPTIONS')) {
      const parts = existing.split(/\[PRESCRIPTIONS(?: ISSUED)?\]/);
      if (parts[1]) {
        const rest = parts[1].split(/\[TESTS & LABS ORDERED\]|\[DIAGNOSTIC ORDERS\]/)[0];
        rx = rest.trim();
      }
    }
    setRxNotes(rx);

    // Tests and Labs
    const labs = [];
    if (existing.includes('[TESTS & LABS ORDERED]') || existing.includes('[DIAGNOSTIC ORDERS]')) {
      COMMON_LAB_ORDERS.forEach(order => {
        if (existing.includes(order)) labs.push(order);
      });
    }
    setSelectedLabOrders(labs);
  };

  const addPrescriptionPreset = (rxString) => {
    setRxNotes(prev => prev ? `${prev}\n• ${rxString}` : `• ${rxString}`);
    toast.success(`Added ${rxString.split(' ')[0]} to prescription`);
  };

  const toggleLabOrder = (order) => {
    setSelectedLabOrders(prev => 
      prev.includes(order) ? prev.filter(o => o !== order) : [...prev, order]
    );
  };

  const compileEncounterSummary = () => {
    const docName = encounterPatient?.assigned_to || currentUsername || 'Bob';
    const lines = [
      `[CLINICAL CONSULTATION & DISCHARGE SUMMARY - Dr. ${docName}]`,
      `Encounter Date/Time: ${new Date().toLocaleString()}`
    ];

    // Manual Vitals recorded by clinician
    const vitalsList = [];
    if (encounterVitals.bp) vitalsList.push(`BP: ${encounterVitals.bp} mmHg`);
    if (encounterVitals.hr) vitalsList.push(`HR: ${encounterVitals.hr} bpm`);
    if (encounterVitals.spo2) vitalsList.push(`SpO2: ${encounterVitals.spo2}%`);
    if (encounterVitals.temp) vitalsList.push(`Temp: ${encounterVitals.temp}°F`);
    if (encounterVitals.rr) vitalsList.push(`RR: ${encounterVitals.rr}/min`);

    if (vitalsList.length > 0) {
      lines.push(`\n[VITALS RECORDED]\n${vitalsList.join(' | ')}`);
    }

    if (clinicalNote.trim()) {
      lines.push(`\n[CLINICAL CONSULTATION NOTE]\n${clinicalNote.trim()}`);
    }

    if (rxNotes.trim()) {
      lines.push(`\n[PRESCRIPTIONS]\n${rxNotes.trim()}`);
    }

    if (selectedLabOrders.length > 0) {
      lines.push(`\n[TESTS & LABS ORDERED]\n${selectedLabOrders.map(o => `• ${o}`).join('\n')}`);
    }

    return lines.join('\n');
  };

  const handleSaveEncounterDraft = async () => {
    if (!encounterPatient) return;
    const summary = compileEncounterSummary();
    const ok = await handleUpdateStatus(
      encounterPatient._id,
      encounterPatient.final_status || 'Pending',
      encounterPatient.assigned_to || currentUsername || 'doctor_bob',
      summary
    );
    if (ok) {
      toast.success('Clinical encounter draft saved to patient chart.');
    }
  };

  const handleCompleteEncounter = async () => {
    if (!encounterPatient) return;
    const summary = compileEncounterSummary();
    const ok = await handleUpdateStatus(
      encounterPatient._id,
      'Completed',
      encounterPatient.assigned_to || currentUsername || 'doctor_bob',
      summary
    );
    if (ok) {
      setEncounterPatient(null);
    }
  };

  const handleClaimPatient = async (patient, openModal = false) => {
    const docName = currentUsername || 'doctor_bob';
    const ok = await handleUpdateStatus(patient._id, 'Assigned to Doctor', docName);
    if (ok) {
      toast.success(`Case claimed! Patient added to your active consultations.`);
      if (openModal) {
        openClinicalEncounter({
          ...patient,
          assigned_to: docName,
          final_status: 'Assigned to Doctor'
        });
      }
    }
  };

  const handleReleasePatient = async (patient) => {
    const ok = await handleUpdateStatus(patient._id, 'Pending', '');
    if (ok) {
      toast.success('Patient released back to available queue.');
    }
  };

  // Counts for tabs & KPIs
  const myCasesCount = queue.filter(a => isMyCase(a) && a.final_status !== 'Completed').length;
  const unassignedCount = queue.filter(isUnassigned).length;
  const assignedCount = queue.filter(a => isAssigned(a) && a.final_status !== 'Completed').length;
  const completedCount = archiveList.filter(a => a.final_status === 'Completed').length;
  const myHighUrgencyCount = queue.filter(a => isMyCase(a) && a.final_status !== 'Completed' && (a.ai_urgency_score === 'Emergency' || a.ai_urgency_score === 'Urgent')).length;

  // Filtered lists
  const filteredQueue = queue.filter(appt => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || (
      (appt.patient_name && appt.patient_name.toLowerCase().includes(q)) ||
      (appt.contact_info && appt.contact_info.toLowerCase().includes(q)) ||
      (appt.raw_symptom_text && appt.raw_symptom_text.toLowerCase().includes(q)) ||
      (appt.assigned_to && appt.assigned_to.toLowerCase().includes(q))
    );
    const matchesFilter = filter === 'All' || appt.ai_urgency_score === filter;

    let matchesTab = true;
    if (activeTab === 'my_cases') {
      matchesTab = isMyCase(appt) && appt.final_status !== 'Completed';
    } else if (activeTab === 'unassigned') {
      matchesTab = isUnassigned(appt);
    } else if (activeTab === 'assigned') {
      matchesTab = isAssigned(appt) && appt.final_status !== 'Completed';
    }

    return matchesSearch && matchesFilter && matchesTab;
  });

  const filteredArchive = archiveList.filter(appt => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || (
      (appt.patient_name && appt.patient_name.toLowerCase().includes(q)) ||
      (appt.contact_info && appt.contact_info.toLowerCase().includes(q)) ||
      (appt.raw_symptom_text && appt.raw_symptom_text.toLowerCase().includes(q)) ||
      (appt.assigned_to && appt.assigned_to.toLowerCase().includes(q))
    );
    const matchesUrgency = filter === 'All' || appt.ai_urgency_score === filter;
    
    if (userRole === 'staff' && activeTab === 'discharged') {
      return matchesSearch && matchesUrgency && appt.final_status === 'Completed';
    }

    const matchesStatus = archiveStatusFilter === 'All' || 
      (archiveStatusFilter === 'Assigned to Doctor'
        ? (appt.final_status === 'Assigned to Doctor' || Boolean(appt.assigned_to))
        : appt.final_status === archiveStatusFilter);
    return matchesSearch && matchesUrgency && matchesStatus;
  });

  const openAssignModal = (appt) => {
    setAssignModal(appt);
    const preferredDoc = appt.assigned_to || 
      staffList.find(s => s.role === 'staff')?.username || 
      (staffList.length > 0 ? staffList[0].username : 'doctor_bob');
    setSelectedDoctor(preferredDoc);
    setDoctorNotes(appt.doctor_notes || '');
  };

  const exportQueueCSV = () => {
    try {
      let listToExport = [];
      if (activeTab === 'archive' || activeTab === 'discharged') {
        listToExport = filteredArchive.length > 0 
          ? filteredArchive 
          : (archiveList.length > 0 ? archiveList : queue);
      } else if (activeTab === 'my_cases') {
        listToExport = filteredQueue.length > 0 ? filteredQueue : queue.filter(isMyCase);
      } else if (activeTab === 'unassigned') {
        listToExport = filteredQueue.length > 0 ? filteredQueue : queue.filter(isUnassigned);
      } else {
        listToExport = filteredQueue.length > 0 ? filteredQueue : queue;
      }

      if (!listToExport || listToExport.length === 0) {
        listToExport = queue.length > 0 ? queue : archiveList;
      }

      if (!listToExport || listToExport.length === 0) {
        toast.error('No patient data available to export.');
        return;
      }

      const headers = ['Priority', 'Patient Name', 'Contact Info', 'Scheduled Time', 'Status', 'Assigned Doctor', 'Symptoms', 'Doctor Notes'];
      const rows = listToExport.map(a => [
        `"${String(a.ai_urgency_score ?? '').replace(/"/g, '""')}"`,
        `"${String(a.patient_name ?? '').replace(/"/g, '""')}"`,
        `"${String(a.contact_info ?? '').replace(/"/g, '""')}"`,
        `"${a.scheduled_time ? new Date(a.scheduled_time).toLocaleString() : 'Not Scheduled'}"`,
        `"${(a.final_status === 'Completed' ? 'Completed' : a.final_status === 'Dismissed' ? 'Dismissed' : a.assigned_to ? 'Assigned' : 'Pending')}"`,
        `"${(a.assigned_to ? `Dr. ${a.assigned_to}` : 'Unassigned')}"`,
        `"${String(a.raw_symptom_text ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`,
        `"${String(a.doctor_notes ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${userRole === 'staff' ? 'clinician_consultation_sheet' : 'triage_handover'}_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link && link.parentNode) {
          link.parentNode.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 500);
      toast.success(`Clinical handover CSV downloaded (${rows.length} records)!`);
    } catch (err) {
      console.error('CSV export failed:', err);
      toast.error(`CSV export error: ${err.message || 'Unable to generate CSV'}`);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 mt-6">
      {/* ============================================================ */}
      {/* ROLE-AWARE HEADER */}
      {/* ============================================================ */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            {userRole === 'staff' ? (
              <div className="p-3 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl shadow-lg shadow-teal-500/20 text-white">
                <Stethoscope className="w-7 h-7" />
              </div>
            ) : (
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/20 text-white">
                <Activity className="w-7 h-7" />
              </div>
            )}
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-400 dark:to-emerald-400">
                {userRole === 'staff' ? 'Clinician Consultation Suite' : 'Coordinator Dashboard'}
              </h2>
              <div className="flex items-center gap-3 mt-1.5">
                <span className={`text-xs font-bold px-3 py-0.5 rounded-full inline-flex items-center gap-1.5 shadow-sm ${
                  userRole === 'staff' 
                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200 border border-teal-200 dark:border-teal-700' 
                    : 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border border-purple-200 dark:border-purple-700'
                }`}>
                  {userRole === 'staff' ? `👨‍⚕️ Attending: Dr. ${currentUsername}` : '🏥 Admin Coordinator'}
                </span>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  Live Clinic Feed
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-56">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder={userRole === 'staff' ? "Search caseload..." : "Search patients..."}
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-teal-500 text-sm shadow-sm"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10 pr-8 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-teal-500 appearance-none bg-white dark:bg-gray-700 text-sm font-medium shadow-sm cursor-pointer"
            >
              <option value="All">All Triage Tiers</option>
              <option value="Emergency">🚨 Emergency Only</option>
              <option value="Urgent">⚠️ Urgent Only</option>
              <option value="Routine">🟢 Routine Only</option>
            </select>
          </div>

          {userRole === 'admin' && (
            <button
              onClick={() => { fetchAuditLogs(); setAuditModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-xs font-semibold shadow-sm transition shrink-0"
              title="View Clinical Audit Trail & Governance Logs"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">Audit Trail</span>
            </button>
          )}

          <button
            onClick={exportQueueCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 text-xs font-semibold shadow-sm transition shrink-0"
            title="Export Clinical Handover Sheet (CSV)"
          >
            <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ROLE-AWARE KPI SUMMARY CARDS */}
      {/* ============================================================ */}
      {userRole === 'staff' ? (
        // Clinician Specific Metrics
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-teal-100 dark:border-teal-900/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">My Active Caseload</p>
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1">{myCasesCount}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Ready for consultation</p>
              </div>
              <div className="p-3 bg-teal-100 dark:bg-teal-900/50 rounded-2xl text-teal-600 dark:text-teal-300">
                <Stethoscope className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-rose-100 dark:border-rose-900/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Immediate Attention</p>
                <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">{myHighUrgencyCount}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">High urgency in my caseload</p>
              </div>
              <div className="p-3 bg-rose-100 dark:bg-rose-900/50 rounded-2xl text-rose-600 dark:text-rose-400">
                <Activity className={`w-6 h-6 ${myHighUrgencyCount > 0 ? 'animate-pulse' : ''}`} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-amber-100 dark:border-amber-900/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Available Queue</p>
                <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{unassignedCount}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Awaiting clinician claim</p>
              </div>
              <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-2xl text-amber-600 dark:text-amber-400">
                <UserPlus className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-emerald-100 dark:border-emerald-900/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Discharged Total</p>
                <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{completedCount}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Completed encounters</p>
              </div>
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-2xl text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Admin Coordinator Metrics
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total in Queue</p>
                <p className="text-3xl font-extrabold text-gray-800 dark:text-white mt-1">{queue.length}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-red-100 dark:border-red-900/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Emergency</p>
                <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">{queue.filter(a => a.ai_urgency_score === 'Emergency').length}</p>
              </div>
              <div className="p-3 bg-rose-100 dark:bg-rose-900/40 rounded-xl">
                <Activity className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-amber-100 dark:border-amber-900/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Urgent</p>
                <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{queue.filter(a => a.ai_urgency_score === 'Urgent').length}</p>
              </div>
              <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-purple-100 dark:border-purple-900/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preemptions</p>
                <p className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">{preemptionEvents.length}</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-xl">
                <Zap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800 font-medium">{error}</div>}

      {/* Emergency Preemption Banner */}
      {showPreemptionBanner && preemptionEvents.length > 0 && (
        <div className="mb-6 animate-pulse">
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-2xl shadow-xl shadow-red-500/20 overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base flex items-center gap-2">
                    ⚡ EMERGENCY PREEMPTION DISPATCHED
                  </h3>
                  <p className="text-red-100 text-xs mt-0.5">
                    <strong>{preemptionEvents[0]?.bumped_patient}</strong> was rescheduled from{' '}
                    {preemptionEvents[0]?.original_time && new Date(preemptionEvents[0].original_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    {' → '}
                    {preemptionEvents[0]?.new_time && new Date(preemptionEvents[0].new_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    {' '}to accommodate critical emergency triage. Notifications sent.
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

      {/* ============================================================ */}
      {/* CASELOAD WORKSPACE NAVIGATION TABS */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1.5 p-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          {userRole === 'staff' ? (
            // Dedicated Clinician Suite Tabs
            <>
              <button
                onClick={() => setActiveTab('my_cases')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'my_cases'
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Stethoscope className="w-4 h-4" />
                My Consultations
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'my_cases' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200'
                }`}>
                  {myCasesCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('unassigned')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'unassigned'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Available Queue
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'unassigned' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                }`}>
                  {unassignedCount}
                </span>
              </button>

              <button
                onClick={() => { setActiveTab('discharged'); fetchArchive(); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'discharged'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <History className="w-4 h-4" />
                Discharged History
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'discharged' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                }`}>
                  {completedCount}
                </span>
              </button>
            </>
          ) : (
            // Admin Coordinator Tabs
            <>
              <button
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'all'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                All Intake Queue
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'all' ? 'bg-purple-700 text-purple-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {queue.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('unassigned')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'unassigned'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Pending Assignment
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'unassigned' ? 'bg-amber-700 text-amber-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {unassignedCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('assigned')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'assigned'
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Assigned to Doctors
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'assigned' ? 'bg-teal-700 text-teal-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {assignedCount}
                </span>
              </button>

              <button
                onClick={() => { setActiveTab('archive'); fetchArchive(); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'archive'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Records Archive
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
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
                  ? 'bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Table
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Calendar Matrix
            </button>
          </div>

          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:block">
            Showing <strong>{activeTab === 'archive' || activeTab === 'discharged' ? filteredArchive.length : filteredQueue.length}</strong> cases
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 1. DOCTOR: MY CONSULTATIONS (ACTIVE CASELOAD PRIMARY VIEW) */}
      {/* ============================================================ */}
      {viewMode === 'table' && userRole === 'staff' && activeTab === 'my_cases' && (
        <div className="space-y-4">
          {loading && queue.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
              Loading clinician caseload...
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="p-12 text-center bg-white/80 dark:bg-gray-800/80 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
              <Stethoscope className="w-12 h-12 mx-auto text-teal-500/50 mb-3" />
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">No active consultations assigned to Dr. {currentUsername}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                You have completed all assigned patient consultations. Check the <strong>Available Queue</strong> tab to claim incoming patients.
              </p>
              <button
                onClick={() => setActiveTab('unassigned')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-teal-500/20 transition"
              >
                <UserPlus className="w-4 h-4" /> Open Available Queue ({unassignedCount})
              </button>
            </div>
          ) : (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-teal-50/50 dark:bg-teal-950/20 text-gray-600 dark:text-gray-300 uppercase text-[11px] tracking-wider border-b border-teal-100 dark:border-teal-900/40">
                      <th className="p-4 font-bold">Urgency & Readiness</th>
                      <th className="p-4 font-bold">Patient Details</th>
                      <th className="p-4 font-bold">Chief Symptoms & AI Triage</th>
                      <th className="p-4 font-bold">Consultation Window</th>
                      <th className="p-4 font-bold text-right">Clinical Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {filteredQueue.map((appt) => {
                      const countdown = getAppointmentCountdown(appt.scheduled_time, currentTime);
                      const readiness = getConsultationReadiness(appt);

                      return (
                        <tr 
                          key={appt._id}
                          onClick={() => openClinicalEncounter(appt)}
                          className={`transition-all duration-200 cursor-pointer ${getRowClass(appt.ai_urgency_score)} ${selectedPatient?._id === appt._id ? 'ring-2 ring-teal-500' : ''}`}
                        >
                          {/* Priority & Readiness */}
                          <td className="p-4">
                            <div className="space-y-1.5">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5 ${getBadgeClass(appt.ai_urgency_score)}`}>
                                <span className={`w-2 h-2 rounded-full bg-current ${appt.ai_urgency_score === 'Emergency' ? 'animate-ping' : ''}`}></span>
                                {appt.ai_urgency_score}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${readiness.dot}`}></span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${readiness.color}`}>
                                  {readiness.label}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Patient Info */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm shrink-0 ${getAvatarColor(appt.ai_urgency_score)}`}>
                                {getInitials(appt.patient_name)}
                              </div>
                              <div>
                                <p className="font-extrabold text-gray-900 dark:text-white text-sm">{appt.patient_name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-gray-400" /> {appt.contact_info}
                                </p>
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 dark:text-teal-400 mt-0.5">
                                  <Stethoscope className="w-3 h-3 text-teal-500" /> Dr. {appt.assigned_to || currentUsername}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Symptoms & AI Flags */}
                          <td className="p-4 max-w-sm">
                            <p className="text-xs text-gray-800 dark:text-gray-200 italic line-clamp-2">
                              "{appt.raw_symptom_text}"
                            </p>
                            {appt.critical_keywords && appt.critical_keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">AI Flags:</span>
                                {appt.critical_keywords.map((word, i) => (
                                  <span key={i} className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200 rounded">
                                    {word}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Scheduling & Live Countdown Timer */}
                          <td className="p-4">
                            <div className={`p-2.5 rounded-xl border flex flex-col gap-1 ${countdown.color}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-extrabold flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                  {countdown.text}
                                </span>
                                <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                                  {countdown.badge}
                                </span>
                              </div>
                              <p className="text-[11px] opacity-90 font-medium">
                                {appt.scheduled_time 
                                  ? new Date(appt.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : 'Queued intake'}
                              </p>
                            </div>
                          </td>

                          {/* Clinician Dedicated Actions */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => openClinicalEncounter(appt)}
                                className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-500/20 flex items-center gap-1.5 transition active:scale-95"
                                title="Open Dedicated Clinical Encounter Suite"
                              >
                                <Stethoscope className="w-3.5 h-3.5" /> Start Consult
                              </button>

                              <button
                                onClick={() => handleReleasePatient(appt)}
                                className="p-2 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition"
                                title="Release patient back to Available Queue"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. DOCTOR: AVAILABLE QUEUE (CLAIM PATIENTS) */}
      {/* ============================================================ */}
      {viewMode === 'table' && userRole === 'staff' && activeTab === 'unassigned' && (
        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-transparent rounded-2xl border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">Available Intake Queue</h3>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Triaged patients awaiting an attending clinician. Claim a case to add it immediately to your active consultations.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded-full text-xs font-bold">
              {unassignedCount} Open Cases
            </span>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="p-12 text-center bg-white/80 dark:bg-gray-800/80 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
              <Check className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
              <h3 className="font-bold text-base text-gray-800 dark:text-gray-200">No unassigned patients waiting</h3>
              <p className="text-xs text-gray-400 mt-1">All triage patients have been claimed by attending clinicians.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredQueue.map(appt => (
                <div 
                  key={appt._id}
                  className="bg-white/90 dark:bg-gray-800/90 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${getBadgeClass(appt.ai_urgency_score)}`}>
                        {appt.ai_urgency_score}
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium">
                        {appt.submission_time ? new Date(appt.submission_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${getAvatarColor(appt.ai_urgency_score)}`}>
                        {getInitials(appt.patient_name)}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-base">{appt.patient_name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{appt.contact_info}</p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-700 dark:text-gray-300 italic line-clamp-3 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-750">
                      "{appt.raw_symptom_text}"
                    </p>

                    {appt.critical_keywords && appt.critical_keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {appt.critical_keywords.map((kw, i) => (
                          <span key={i} className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded">
                            ⚠️ {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center gap-2">
                    <button
                      onClick={() => handleClaimPatient(appt, false)}
                      className="flex-1 py-2 px-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Claim Case
                    </button>
                    <button
                      onClick={() => handleClaimPatient(appt, true)}
                      className="py-2 px-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 transition flex items-center gap-1"
                      title="Claim and instantly open consultation drawer"
                    >
                      <Stethoscope className="w-3.5 h-3.5" /> Consult
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. DOCTOR: DISCHARGED HISTORY TAB */}
      {/* ============================================================ */}
      {viewMode === 'table' && userRole === 'staff' && activeTab === 'discharged' && (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-emerald-50/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Clinician Discharged Consultations</h3>
              <span className="text-xs text-gray-500 font-medium">({filteredArchive.length} records)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 uppercase text-[11px] tracking-wider">
                  <th className="p-4 font-bold">Priority</th>
                  <th className="p-4 font-bold">Patient</th>
                  <th className="p-4 font-bold">Attending Clinician</th>
                  <th className="p-4 font-bold">Symptoms & Clinical Discharge Notes</th>
                  <th className="p-4 font-bold">Discharged At</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredArchive.length === 0 ? (
                  <tr><td colSpan="6" className="p-12 text-center text-gray-400 text-sm">No completed consultations match your search.</td></tr>
                ) : (
                  filteredArchive.map(appt => (
                    <tr 
                      key={appt._id} 
                      onClick={() => openClinicalEncounter(appt)} 
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition"
                    >
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${getBadgeClass(appt.ai_urgency_score)}`}>
                          {appt.ai_urgency_score}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{appt.patient_name}</p>
                        <p className="text-xs text-gray-500">{appt.contact_info}</p>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                          <Stethoscope className="w-3.5 h-3.5" /> Dr. {appt.assigned_to || currentUsername}
                        </span>
                      </td>
                      <td className="p-4 max-w-sm">
                        <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-1 italic">"{appt.raw_symptom_text}"</p>
                        {appt.doctor_notes && (
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium line-clamp-2 bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                            {appt.doctor_notes}
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-xs text-gray-600 dark:text-gray-400">
                        {appt.scheduled_time ? new Date(appt.scheduled_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recorded'}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); openClinicalEncounter(appt); }}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-xl text-xs font-bold transition flex items-center gap-1 ml-auto"
                        >
                          <FileText className="w-3.5 h-3.5" /> Review Chart
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

      {/* ============================================================ */}
      {/* 4. ADMIN COORDINATOR QUEUE TABLE */}
      {/* ============================================================ */}
      {viewMode === 'table' && userRole === 'admin' && activeTab !== 'archive' && (
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
                  <tr><td colSpan="5" className="p-12 text-center text-gray-500">No appointments found in this view.</td></tr>
                ) : (
                  filteredQueue.map((appt) => (
                    <tr 
                      key={appt._id} 
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
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${getAvatarColor(appt.ai_urgency_score)}`}>
                            {getInitials(appt.patient_name)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 dark:text-white">{appt.patient_name}</p>
                            <p className="text-sm opacity-80 dark:text-gray-300">{appt.contact_info}</p>
                            {appt.assigned_to && (
                              <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1 mt-0.5">
                                <Stethoscope className="w-3 h-3 text-teal-500" /> Dr. {appt.assigned_to}
                              </span>
                            )}
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
                          </div>
                          <button onClick={(e) => { 
                            e.stopPropagation();
                            setScheduleModal(appt); 
                            if(appt.scheduled_time) {
                              const tzoffset = (new Date()).getTimezoneOffset() * 60000;
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
                          <button onClick={(e) => { e.stopPropagation(); setSelectedPatient(appt); }}
                            className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/50 rounded-lg transition" title="Inspect Full Clinical Case">
                            <Eye className="w-5 h-5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openAssignModal(appt); }}
                            className="p-2 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50 rounded-lg transition" title="Assign to Doctor">
                            <UserCheck className="w-5 h-5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmModal({ id: appt._id, action: 'Dismissed', name: appt.patient_name }); }}
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
      )}

      {/* ============================================================ */}
      {/* 5. ADMIN COMPLETE HISTORICAL ARCHIVE TABLE */}
      {/* ============================================================ */}
      {viewMode === 'table' && userRole === 'admin' && activeTab === 'archive' && (
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
                          {appt.ai_urgency_score}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-gray-800 dark:text-white text-sm">{appt.patient_name}</p>
                        <p className="text-xs text-gray-500">{appt.contact_info}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          appt.final_status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                          appt.final_status === 'Dismissed' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
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

      {/* ============================================================ */}
      {/* 6. CLINICAL SCHEDULE CALENDAR MATRIX */}
      {/* ============================================================ */}
      {viewMode === 'calendar' && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-xl rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-teal-600 dark:text-teal-400" /> Clinic Schedule & Slot Matrix
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
                className="px-3 py-1.5 bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-xs font-bold rounded-lg border border-teal-200 dark:border-teal-800 hover:bg-teal-100"
              >
                Today
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {[
              '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
              '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
              '15:00', '15:30', '16:00', '16:30'
            ].map((slotTime) => {
              const allAppointments = queue.length > 0 ? queue : archiveList;
              const booked = allAppointments.find(a => {
                if (!a.scheduled_time) return false;
                const d = new Date(a.scheduled_time);
                if (isNaN(d.getTime())) return false;
                
                const utcDate = d.toISOString().slice(0, 10);
                const utcHour = String(d.getUTCHours()).padStart(2, '0');
                const utcMin = d.getUTCMinutes() >= 30 ? '30' : '00';
                const utcSlot = `${utcHour}:${utcMin}`;

                const localY = d.getFullYear();
                const localM = String(d.getMonth() + 1).padStart(2, '0');
                const localD = String(d.getDate()).padStart(2, '0');
                const localDate = `${localY}-${localM}-${localD}`;
                const localHour = String(d.getHours()).padStart(2, '0');
                const localMin = d.getMinutes() >= 30 ? '30' : '00';
                const localSlot = `${localHour}:${localMin}`;

                return (utcDate === selectedCalendarDate && utcSlot === slotTime) ||
                       (localDate === selectedCalendarDate && localSlot === slotTime);
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
                      onClick={() => userRole === 'staff' ? openClinicalEncounter(booked) : setSelectedPatient(booked)}
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

      {/* ============================================================ */}
      {/* 7. DEDICATED CLINICAL ENCOUNTER SUITE DRAWER / MODAL */}
      {/* ============================================================ */}
      {encounterPatient && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setEncounterPatient(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white dark:bg-gray-800 shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-700 animate-in slide-in-from-right duration-300">
              {/* Encounter Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-transparent flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-md ${getAvatarColor(encounterPatient.ai_urgency_score)}`}>
                    {getInitials(encounterPatient.patient_name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">{encounterPatient.patient_name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${getBadgeClass(encounterPatient.ai_urgency_score)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full bg-current ${encounterPatient.ai_urgency_score === 'Emergency' ? 'animate-ping' : ''}`}></span>
                        {encounterPatient.ai_urgency_score}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" /> {encounterPatient.contact_info}</span>
                      <span>•</span>
                      <span className="text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
                        <Stethoscope className="w-3.5 h-3.5" /> Dr. {encounterPatient.assigned_to || currentUsername}
                      </span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setEncounterPatient(null)} 
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Encounter Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. Patient Info & Reported Intake Symptoms */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-teal-600" /> Patient Reported Intake Symptoms
                    </h4>
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                      {encounterPatient.submission_time ? new Date(encounterPatient.submission_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Intake recorded'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white font-medium italic bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                    "{encounterPatient.raw_symptom_text}"
                  </p>
                  {encounterPatient.critical_keywords && encounterPatient.critical_keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Triage Red Flags:</span>
                      {encounterPatient.critical_keywords.map((kw, i) => (
                        <span key={i} className="text-[10px] font-bold uppercase px-2 py-0.5 bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200 rounded-md">
                          ⚠️ {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Manual Vitals Entry by Doctor */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-teal-600" /> Manual Vitals Entry (Recorded by Clinician)
                    </h4>
                    <span className="text-[11px] text-gray-400">Enter measured clinical vitals</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {/* BP */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase">
                        <span>Blood Pressure</span>
                        <Heart className="w-3 h-3 text-rose-500" />
                      </div>
                      <input 
                        type="text" 
                        value={encounterVitals.bp} 
                        onChange={(e) => setEncounterVitals(v => ({ ...v, bp: e.target.value }))}
                        className="w-full mt-1 font-bold text-sm text-gray-900 dark:text-white bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-teal-500"
                        placeholder="e.g. 120/80"
                      />
                      <span className="text-[10px] text-gray-400">mmHg</span>
                    </div>

                    {/* HR */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase">
                        <span>Heart Rate</span>
                        <Activity className="w-3 h-3 text-red-500" />
                      </div>
                      <input 
                        type="text" 
                        value={encounterVitals.hr} 
                        onChange={(e) => setEncounterVitals(v => ({ ...v, hr: e.target.value }))}
                        className="w-full mt-1 font-bold text-sm text-gray-900 dark:text-white bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-teal-500"
                        placeholder="e.g. 72"
                      />
                      <span className="text-[10px] text-gray-400">bpm</span>
                    </div>

                    {/* SpO2 */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase">
                        <span>Oxygen (SpO2)</span>
                        <Activity className="w-3 h-3 text-cyan-500" />
                      </div>
                      <input 
                        type="text" 
                        value={encounterVitals.spo2} 
                        onChange={(e) => setEncounterVitals(v => ({ ...v, spo2: e.target.value }))}
                        className="w-full mt-1 font-bold text-sm text-gray-900 dark:text-white bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-teal-500"
                        placeholder="e.g. 98"
                      />
                      <span className="text-[10px] text-gray-400">%</span>
                    </div>

                    {/* Temp */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase">
                        <span>Temperature</span>
                        <Thermometer className="w-3 h-3 text-amber-500" />
                      </div>
                      <input 
                        type="text" 
                        value={encounterVitals.temp} 
                        onChange={(e) => setEncounterVitals(v => ({ ...v, temp: e.target.value }))}
                        className="w-full mt-1 font-bold text-sm text-gray-900 dark:text-white bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-teal-500"
                        placeholder="e.g. 98.6"
                      />
                      <span className="text-[10px] text-gray-400">°F</span>
                    </div>

                    {/* RR */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase">
                        <span>Resp Rate</span>
                        <Clock className="w-3 h-3 text-blue-500" />
                      </div>
                      <input 
                        type="text" 
                        value={encounterVitals.rr} 
                        onChange={(e) => setEncounterVitals(v => ({ ...v, rr: e.target.value }))}
                        className="w-full mt-1 font-bold text-sm text-gray-900 dark:text-white bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-teal-500"
                        placeholder="e.g. 16"
                      />
                      <span className="text-[10px] text-gray-400">breaths/min</span>
                    </div>
                  </div>
                </div>

                {/* 3. Doctor's Clinical Consultation Note */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4 text-teal-600" /> Doctor's Clinical Consultation Note
                    </h4>
                    <span className="text-[11px] text-gray-400">Clinical observations, exam findings & diagnosis</span>
                  </div>
                  <textarea
                    rows="4"
                    value={clinicalNote}
                    onChange={(e) => setClinicalNote(e.target.value)}
                    placeholder="Document clinical observations, diagnosis, exam findings, and management instructions..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-750 dark:text-white text-xs font-medium focus:ring-2 focus:ring-teal-500 shadow-sm leading-relaxed"
                  />
                </div>

                {/* 4. Prescriptions Suite (Medication, Dosage, Instructions) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                      <Pill className="w-4 h-4 text-teal-600" /> Prescriptions Suite (Medication, Dosage, Instructions)
                    </label>
                    <span className="text-[11px] text-gray-400">Click chips to quickly append Rx</span>
                  </div>

                  {/* Presets Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {COMMON_PRESCRIPTIONS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => addPrescriptionPreset(item.dosage)}
                        className="text-[11px] font-semibold px-2.5 py-1 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 rounded-lg border border-teal-200 dark:border-teal-800 hover:bg-teal-100 transition"
                      >
                        + {item.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows="3"
                    value={rxNotes}
                    onChange={(e) => setRxNotes(e.target.value)}
                    placeholder="Enter prescribed medications, dosage, frequency, and instructions (e.g. Amoxicillin 500mg PO TID x 7 days)..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-750 dark:text-white text-xs font-mono focus:ring-2 focus:ring-teal-500 shadow-sm"
                  />
                </div>

                {/* 5. Tests and Labs (Laboratory & Diagnostic orders) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-indigo-600" /> Tests and Labs (Laboratory & Diagnostic Orders)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {COMMON_LAB_ORDERS.map((order, idx) => {
                      const isSelected = selectedLabOrders.includes(order);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleLabOrder(order)}
                          className={`p-2.5 rounded-xl border text-left text-xs font-medium transition flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 text-indigo-800 dark:text-indigo-200 shadow-sm'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span className="truncate pr-2">{order}</span>
                          <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] shrink-0 ${
                            isSelected ? 'bg-indigo-600 text-white font-bold' : 'border border-gray-300 dark:border-gray-600'
                          }`}>
                            {isSelected ? '✓' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Drawer Sticky Footer with 1-Click Complete Consultation / Discharge */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-900/80 flex items-center gap-3">
                <button
                  onClick={handleSaveEncounterDraft}
                  className="py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold hover:bg-gray-100 transition shadow-sm"
                  title="Save current encounter notes without discharging"
                >
                  Save Draft
                </button>

                <button
                  onClick={handleCompleteEncounter}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Complete Consultation & Discharge Patient
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 8. ADMIN MODALS (Priority Override, Schedule, Assignment) */}
      {/* ============================================================ */}
      {overrideModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setOverrideModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold dark:text-white mb-2">Manual Priority Override</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select a new priority for <strong>{overrideModal.patient_name}</strong>.
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
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Clinical reason for changing priority..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 mb-6"
            />
            <div className="flex gap-3">
              <button onClick={() => setOverrideModal(null)} className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-xl font-medium">Cancel</button>
              <button onClick={executeOverride} className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-xl font-bold">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {scheduleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setScheduleModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold dark:text-white mb-2">Edit Schedule Time</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Manually set the appointment time for <strong>{scheduleModal.patient_name}</strong>.
            </p>
            <input 
              type="datetime-local" 
              value={newSchedule} 
              onChange={(e) => setNewSchedule(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 mb-6"
            />
            <div className="flex gap-3">
              <button onClick={() => setScheduleModal(null)} className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-xl font-medium">Cancel</button>
              <button onClick={executeScheduleOverride} className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-xl font-bold">Save Time</button>
            </div>
          </div>
        </div>
      )}

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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to Attending Clinician</label>
                <select 
                  value={selectedDoctor} 
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 font-medium"
                >
                  <option value="">-- Choose Attending Clinician --</option>
                  {(staffList.length > 0 ? staffList : [{ username: 'doctor_bob', role: 'staff' }]).map(s => (
                    <option key={s.username} value={s.username}>
                      {s.username === 'doctor_bob' ? '👨‍⚕️ Dr. Bob (Attending Clinician)' : `${s.username} (${s.role})`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clinical Notes (optional)</label>
                <textarea rows="3" value={doctorNotes} onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Instructions for attending doctor..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button 
                onClick={async () => { 
                  if (!selectedDoctor) {
                    toast.error('Please select an attending clinician');
                    return;
                  }
                  await handleUpdateStatus(assignModal._id, 'Assigned to Doctor', selectedDoctor, doctorNotes); 
                  setAssignModal(null); 
                }}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:shadow-green-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Admin Case Inspection Drawer */}
      {selectedPatient && userRole === 'admin' && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setSelectedPatient(null)} />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-lg bg-white dark:bg-gray-800 shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-700 animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-sm ${getAvatarColor(selectedPatient.ai_urgency_score)}`}>
                    {getInitials(selectedPatient.patient_name)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedPatient.patient_name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{selectedPatient.contact_info}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPatient(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Symptoms</h4>
                  <p className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl italic">"{selectedPatient.raw_symptom_text}"</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Triage Classification</h4>
                  <p className="font-bold text-gray-900 dark:text-white">{selectedPatient.ai_urgency_score}</p>
                </div>
                {selectedPatient.doctor_notes && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Clinician Notes</h4>
                    <p className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-xs font-mono">{selectedPatient.doctor_notes}</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <button onClick={() => openAssignModal(selectedPatient)} className="flex-1 py-2 px-3 bg-emerald-600 text-white rounded-xl text-xs font-bold">Assign Doctor</button>
                <button onClick={() => setConfirmModal({ id: selectedPatient._id, action: 'Dismissed', name: selectedPatient.patient_name })} className="py-2 px-3 border border-red-300 text-red-600 rounded-xl text-xs font-bold">Dismiss</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Audit Trail Modal */}
      {auditModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAuditModalOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full p-6 border border-gray-200 dark:border-gray-700 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Clinical Governance & Audit Trail
              </h3>
              <button onClick={() => setAuditModalOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <X className="w-5 h-5 dark:text-gray-300" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              {loadingAudit ? (
                <p className="text-center p-8 text-sm text-gray-500">Loading audit records...</p>
              ) : auditLogs.length === 0 ? (
                <p className="text-center p-8 text-gray-400 text-sm">No clinical overrides recorded yet.</p>
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
                          Priority changed from <span className="font-bold">{log.old_priority}</span> ➔ <span className="font-bold text-purple-600">{log.new_priority}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">"{log.reason}"</p>
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
              <button onClick={() => setAuditModalOpen(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-xs font-semibold">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
