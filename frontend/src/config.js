// Central API configuration — reads from environment variable at build time
export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// WebSocket URL — derived from API_URL (http→ws, https→wss)
export const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';

