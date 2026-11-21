import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Activity, Clock, AlertCircle } from 'lucide-react';
import { API_URL } from '../config';

export default function PatientPortal() {
  const loggedInUser = localStorage.getItem('username') || '';
  const [formData, setFormData] = useState({
    patient_name: loggedInUser,
    contact_info: '',
    symptom_text: ''
  });
  const [painLevel, setPainLevel] = useState(3);
  const [duration, setDuration] = useState('1–2 Days');
  const [hasFever, setHasFever] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (loggedInUser && !formData.patient_name) {
      setFormData(prev => ({ ...prev, patient_name: loggedInUser }));
    }
  }, [loggedInUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.symptom_text.trim().length < 10) {
      setError('Please describe your symptoms in at least 10 characters so the triage model has sufficient context.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = localStorage.getItem('token');
      // Format structured clinical vitals context with free text
      const enrichedSymptoms = `[Vitals: Pain ${painLevel}/10 | Duration: ${duration}${hasFever ? ' | Fever reported' : ''}] ${formData.symptom_text.trim()}`;
      
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
      setPainLevel(3);
      setDuration('1–2 Days');
      setHasFever(false);
      toast.success(`Triage complete! Priority: ${data.urgency}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPainLevelColor = (level) => {
    if (level <= 3) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200';
    if (level <= 6) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200';
    return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200';
  };

  const getPainLevelLabel = (level) => {
    if (level <= 3) return 'Mild Discomfort (1–3) 😊';
    if (level <= 6) return 'Moderate Pain (4–6) 😐';
    return 'Severe / Acute Pain (7–10) 😫';
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

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
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
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Patient Full Name</label>
            <input 
              type="text" required
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
              value={formData.patient_name}
              onChange={(e) => setFormData({...formData, patient_name: e.target.value})}
              placeholder="e.g. John Doe"
            />
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

        {/* Structured Clinical Vitals */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700/60 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                Pain Scale Assessment: 
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getPainLevelColor(painLevel)}`}>
                  {getPainLevelLabel(painLevel)}
                </span>
              </label>
            </div>
            <input 
              type="range" min="1" max="10" step="1"
              value={painLevel}
              onChange={(e) => setPainLevel(parseInt(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-semibold">
              <span>1 (No Pain)</span>
              <span>5 (Moderate)</span>
              <span>10 (Severe / Worst Pain)</span>
            </div>
          </div>

          <div>
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

          <div className="flex items-center gap-2 pt-1">
            <input 
              type="checkbox" 
              id="feverCheck"
              checked={hasFever} 
              onChange={(e) => setHasFever(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="feverCheck" className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              I am experiencing a fever or chills
            </label>
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Describe your symptoms in detail</label>
          <textarea 
            required minLength={10} rows="3"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
            value={formData.symptom_text}
            onChange={(e) => setFormData({...formData, symptom_text: e.target.value})}
            placeholder="E.g., I have sharp chest discomfort radiating to my left arm, feeling breathless since morning..."
          />
          <p className="text-[11px] text-gray-400 mt-1">Minimum 10 characters ({formData.symptom_text.trim().length}/10)</p>
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
