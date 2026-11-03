import { Activity, ShieldCheck, Clock } from 'lucide-react';

export default function LandingPage({ onEnter }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex flex-col items-center justify-center p-6 text-gray-800">
      
      <div className="max-w-4xl text-center space-y-8">
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-200">
            <Activity className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="text-5xl font-extrabold tracking-tight">
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">TeleTriage AI</span>
        </h1>
        
        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Our state-of-the-art NLP AI system analyzes your symptoms in real-time to ensure you get the right care, right when you need it. 
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 mb-12">
          <div className="p-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center">
            <Activity className="w-8 h-8 text-blue-500 mb-4" />
            <h3 className="text-lg font-bold">Instant Analysis</h3>
            <p className="text-sm text-gray-500 text-center mt-2">Symptoms are processed instantly by our clinical ML model.</p>
          </div>
          <div className="p-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center">
            <Clock className="w-8 h-8 text-purple-500 mb-4" />
            <h3 className="text-lg font-bold">Smart Queuing</h3>
            <p className="text-sm text-gray-500 text-center mt-2">Emergencies are automatically routed to the top of the waitlist.</p>
          </div>
          <div className="p-6 bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center">
            <ShieldCheck className="w-8 h-8 text-green-500 mb-4" />
            <h3 className="text-lg font-bold">Secure & Private</h3>
            <p className="text-sm text-gray-500 text-center mt-2">Your data is transmitted securely to our certified medical staff.</p>
          </div>
        </div>

        <button 
          onClick={onEnter}
          className="mt-8 px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-bold rounded-full shadow-lg shadow-indigo-300 hover:shadow-indigo-400 transform hover:-translate-y-1 transition-all duration-300"
        >
          Start Triage Assessment
        </button>
      </div>

    </div>
  );
}
