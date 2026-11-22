import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Clock, CheckSquare, Square, Stethoscope, User, Users, Edit2 } from 'lucide-react';
import { API_URL } from '../config';

const COMMON_SYMPTOMS = [
  'Chest Pain / Pressure',
  'Shortness of Breath',
  'High Fever >38.5°C',
  'Severe Headache',
  'Dizziness / Fainting',
  'Nausea / Vomiting',
  'Allergic Reaction / Swelling',
  'Acute Injury / Bleeding',
  'Cough / Sore Throat',
  'Abdominal Pain'
];

export default function PatientPortal({ onAppointmentCreated }) {
  const loggedInUser = localStorage.getItem('username') || '';
  const [formData, setFormData] = useState({
    patient_name: loggedInUser,
    contact_info: '',
    symptom_text: ''
  });
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [duration, setDuration] = useState('1–2 Days');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loggedInUser && !formData.patient_name) {
      setFormData(prev => ({ ...prev, patient_name: loggedInUser }));
    }
  }, [loggedInUser, formData.patient_name]);

  const toggleSymptom = (symptom) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const clearSelectedSymptoms = () => {
    setSelectedSymptoms([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const narrativeText = formData.symptom_text.trim();
    const hasCheckboxes = selectedSymptoms.length > 0;

    if (!hasCheckboxes && narrativeText.length < 10) {
      setError('Please select at least one symptom from the checklist or describe your symptoms in at least 10 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = localStorage.getItem('token');

      // Cleanly combine selected symptom checkboxes, duration, and clinical narrative
      const clinicalParts = [];
      if (selectedSymptoms.length > 0) {
        clinicalParts.push(`Reported Symptoms: ${selectedSymptoms.join(', ')}`);
      }
      if (duration) {
        clinicalParts.push(`Duration: ${duration}`);
      }

      let enrichedSymptoms = '';
      if (narrativeText) {
        enrichedSymptoms = clinicalParts.length > 0
          ? `[${clinicalParts.join(' | ')}] ${narrativeText}`
          : narrativeText;
      } else {
        enrichedSymptoms = `[${clinicalParts.join(' | ')}] Patient presents with ${selectedSymptoms.join(', ')} experienced for ${duration}.`;
      }

      const payload = {
        patient_name: formData.patient_name,
        contact_info: formData.contact_info,
        symptom_text: enrichedSymptoms
      };

      const response = await fetch(`${API_URL}/submit-symptoms`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to submit symptoms');
      }
      
      const data = await response.json();
      setResult(data);
      setFormData({ patient_name: loggedInUser, contact_info: '', symptom_text: '' });
      setSelectedSymptoms([]);
      setDuration('1–2 Days');
      toast.success(`Triage complete! Priority: ${data.urgency}`);
      if (onAppointmentCreated) {
        onAppointmentCreated(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (urgency) => {
    switch(urgency) {
      case 'Emergency': return 'bg-red-100 text-red-800 border-red-500 shadow-red-500/50 animate-pulse';
      case 'Urgent': return 'bg-yellow-100 text-yellow-800 border-yellow-500 shadow-yellow-500/50';
      case 'Routine': return 'bg-green-100 text-green-800 border-green-500 shadow-green-500/50';
      default: return 'bg-gray-100 text-gray-800 border-gray-500';
    }
  };

  const durationOptions = ['< 2 Hours', '1–2 Days', '3–7 Days', '> 1 Week'];

  const isRedFlag = (symptom) => {
    return ['Chest Pain / Pressure', 'Shortness of Breath', 'Acute Injury / Bleeding', 'Allergic Reaction / Swelling'].includes(symptom);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Clinical Symptom Intake
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            AI-driven clinical triage & priority scheduling
          </p>
        </div>
        {loggedInUser && (
          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-100 dark:border-indigo-800">
            👤 Logged in as <strong>{loggedInUser}</strong>
          </span>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Patient Full Name
              </label>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                <Edit2 className="w-2.5 h-2.5" />
                Editable
              </span>
            </div>
            <div className="relative">
              <input 
                type="text" required
                className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                value={formData.patient_name}
                onChange={(e) => setFormData({...formData, patient_name: e.target.value})}
                placeholder="e.g. John Doe, Sarah Doe, Rayan"
              />
              <User className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute left-3 top-3 pointer-events-none" />
            </div>
            <div className="mt-1.5 flex items-start gap-1.5 p-2 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-[11px] leading-tight">
              <Users className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
              <span>
                <strong>Booking for yourself or someone else?</strong> You can edit this name (e.g. spouse, child, parent).
              </span>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Contact Phone or Email</label>
            <input 
              type="text" required
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
              value={formData.contact_info}
              onChange={(e) => setFormData({...formData, contact_info: e.target.value})}
              placeholder="e.g. +60123456789 or user@email.com"
            />
          </div>
        </div>

        {/* Common Symptoms Checkboxes Section */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Common Symptoms &amp; Red Flags
              </label>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-100 dark:border-indigo-800">
                {selectedSymptoms.length} selected
              </span>
            </div>
            {selectedSymptoms.length > 0 && (
              <button
                type="button"
                onClick={clearSelectedSymptoms}
                className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition font-medium"
              >
                Clear all
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Select all symptoms that currently apply to your condition:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {COMMON_SYMPTOMS.map((symptom) => {
              const isChecked = selectedSymptoms.includes(symptom);
              const redFlag = isRedFlag(symptom);

              return (
                <div
                  key={symptom}
                  onClick={() => toggleSymptom(symptom)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                    isChecked
                      ? redFlag
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 font-bold shadow-sm'
                        : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-bold shadow-sm'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                  }`}
                >
                  <div className="shrink-0">
                    {isChecked ? (
                      <CheckSquare className={`w-4 h-4 ${redFlag ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>
                  <span className="flex-1 leading-snug">{symptom}</span>
                  {redFlag && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                      Alert
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Symptom Duration Selector */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700/60 mt-3">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              Symptom Duration:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {durationOptions.map(opt => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setDuration(opt)}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    duration === opt
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Freeform Symptom Narrative */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Additional Clinical Details &amp; Symptom Narrative
          </label>
          <textarea 
            rows="3"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
            value={formData.symptom_text}
            onChange={(e) => setFormData({...formData, symptom_text: e.target.value})}
            placeholder="Describe any additional sensations, radiating pain, onset, triggers, or medical history..."
          />
          <p className="text-[11px] text-gray-400 mt-1">
            {selectedSymptoms.length > 0 
              ? `${selectedSymptoms.length} symptom(s) selected from checklist.` 
              : 'Please select symptoms from the checklist above or describe your symptoms.'}
          </p>
        </div>
        
        <button 
          type="submit" disabled={loading}
          className={`w-full py-3.5 px-6 text-white text-sm font-bold rounded-xl shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 ${loading ? 'bg-indigo-400' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-indigo-500/50'}`}
        >
          {loading ? 'Processing via AI Triage...' : 'Submit Symptoms for Triage'}
        </button>
      </form>

      {error && <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800 text-sm">{error}</div>}
      
      {result && result.urgency === 'Emergency' && (
        <div className="mt-8 rounded-2xl overflow-hidden shadow-2xl shadow-red-500/20 border border-red-300 transition-all duration-500 animate-pulse">
          <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">🚨 Emergency Fast-Track Activated</h3>
          </div>
          <div className="bg-red-50 px-6 py-5">
            <p className="text-red-800 font-medium mb-3">
              Your symptoms have been classified as <strong className="text-red-900">EMERGENCY</strong>. You have been fast-tracked to the earliest available appointment.
            </p>
            {result.appointment_details?.scheduled_time && (
              <div className="bg-white border border-red-200 rounded-xl p-4 mb-3">
                <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Your Emergency Appointment</p>
                <p className="text-lg font-bold text-red-900 mt-1">
                  {new Date(result.appointment_details.scheduled_time).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                </p>
              </div>
            )}
            <div className="bg-red-100 border-l-4 border-red-700 rounded-lg p-3 mb-3">
              <p className="text-sm font-bold text-red-900">
                If this is a life-threatening medical emergency, please call your local emergency services (e.g., 999 / 911) or go to the nearest Emergency Department immediately.
              </p>
            </div>
            <p className="text-sm text-red-600">A confirmation email has been sent. Please arrive as early as possible. A coordinator will contact you shortly.</p>
          </div>
        </div>
      )}

      {result && result.urgency !== 'Emergency' && (
        <div className={`mt-8 p-6 rounded-xl border-l-4 shadow-lg transition-all duration-500 ${getUrgencyColor(result.urgency)}`}>
          <h3 className="text-xl font-bold mb-2">Triage Complete</h3>
          <p className="mb-1"><strong>Assigned Urgency:</strong> {result.urgency}</p>
          {result.appointment_details?.scheduled_time && (
            <p className="mb-1"><strong>Scheduled For:</strong> {new Date(result.appointment_details.scheduled_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
          )}
          <p className="text-sm opacity-80 mt-3">Your appointment has been logged. Please wait for a coordinator to assist you.</p>
        </div>
      )}
    </div>
  );
}
