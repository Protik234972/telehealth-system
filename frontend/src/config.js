// Central API configuration
const isProd = import.meta.env.PROD;
export const API_URL = import.meta.env.VITE_API_URL || (isProd ? 'https://telehealth-system.onrender.com' : 'http://127.0.0.1:8000');

// WebSocket URL — derived from API_URL (http→ws, https→wss)
export const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';
