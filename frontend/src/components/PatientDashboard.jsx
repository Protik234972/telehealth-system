import { useState, useEffect } from 'react';
import PatientPortal from './PatientPortal';
import toast from 'react-hot-toast';
import { Calendar, AlertTriangle } from 'lucide-react';
import { API_URL, WS_URL } from '../config';

export default function PatientDashboard({ onLogout }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

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
        setAppointments(data.queue);
      }
    } catch (err) {
      console.error(err);
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
    if (status === 'Pending') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
    if (status.includes('Assigned')) return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 mt-6">
      <h2 className="text-3xl font-bold dark:text-white text-gray-800 mb-8">My Patient Dashboard</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-xl font-bold mb-4 dark:text-gray-300 text-gray-700">Submit New Symptoms</h3>
          <PatientPortal />
        </div>

        <div>
          <h3 className="text-xl font-bold mb-4 dark:text-gray-300 text-gray-700">My Appointments</h3>
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
            {loading ? (
              <p className="p-8 text-center text-gray-500">Loading appointments...</p>
            ) : appointments.length === 0 ? (
              <p className="p-8 text-center text-gray-500">You have no past or pending appointments.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {appointments.map(appt => (
                  <li key={appt._id} className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold dark:text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-500" />
                        {appt.scheduled_time 
                          ? new Date(appt.scheduled_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                          : new Date(appt.submission_time).toLocaleString()}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusStyle(appt.final_status)}`}>
                        {appt.final_status}
                      </span>
                    </div>
                    <p className="text-sm dark:text-gray-300 text-gray-600 mb-2 italic">"{appt.raw_symptom_text}"</p>
                    <p className="text-xs text-gray-500 mb-1">AI Priority: <strong>{appt.ai_urgency_score}</strong></p>
                    
                    {/* Show preemption warning */}
                    {appt.preempted && (
                      <div className="mt-3 p-4 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2 mb-3">
                          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Schedule Changed — Emergency Preemption</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{appt.preempt_reason}</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          {appt.original_time && (
                            <div className="flex-1 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-2.5">
                              <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">❌ Previous</p>
                              <p className="text-sm text-red-700 dark:text-red-300 line-through mt-0.5">
                                {new Date(appt.original_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                              </p>
                            </div>
                          )}
                          <div className="flex-1 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-2.5">
                            <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">✅ New Time</p>
                            <p className="text-sm text-green-700 dark:text-green-300 font-bold mt-0.5">
                              {new Date(appt.scheduled_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-2 italic">An email and/or SMS notification has been sent. Contact the clinic if this time doesn't work.</p>
                      </div>
                    )}

                    {/* Show doctor assignment details */}
                    {appt.assigned_to && (
                      <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                          Assigned to: <strong>{appt.assigned_to}</strong>
                        </p>
                        {appt.doctor_notes && (
                          <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                            Doctor's Notes: "{appt.doctor_notes}"
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
