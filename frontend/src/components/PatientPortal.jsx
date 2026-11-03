import { useState } from 'react';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

export default function PatientPortal() {
  const [formData, setFormData] = useState({
    patient_name: '',
    contact_info: '',
    symptom_text: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/submit-symptoms`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) throw new Error('Failed to submit symptoms');
      
      const data = await response.json();
      setResult(data);
      setFormData({ patient_name: '', contact_info: '', symptom_text: '' });
      toast.success(`Triage complete! Priority: ${data.urgency}`);
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

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 mt-10 transition-all duration-300">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
        AI Patient Intake Portal
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input 
            type="text" required
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
            value={formData.patient_name}
            onChange={(e) => setFormData({...formData, patient_name: e.target.value})}
            placeholder="John Doe"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Information</label>
          <input 
            type="text" required
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
            value={formData.contact_info}
            onChange={(e) => setFormData({...formData, contact_info: e.target.value})}
            placeholder="Phone number or Email"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Describe your symptoms in detail</label>
          <textarea 
            required rows="4"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
            value={formData.symptom_text}
            onChange={(e) => setFormData({...formData, symptom_text: e.target.value})}
            placeholder="I have been experiencing a sharp pain in my chest for the last 2 hours..."
          />
        </div>
        
        <button 
          type="submit" disabled={loading}
          className={`w-full py-4 px-6 text-white font-bold rounded-xl shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${loading ? 'bg-indigo-400' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-indigo-500/50'}`}
        >
          {loading ? 'Processing via AI...' : 'Submit Symptoms'}
        </button>
      </form>

      {error && <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>}
      
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
