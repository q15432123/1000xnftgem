// API Client for 1000XNFT GEM

const API_BASE = 'http://localhost:3000/api/v1';
const WS_URL = 'ws://localhost:3000';
const API_KEY = '1XNFT_sk_live_a9f3c2e1b4d7890f23456789abcdef01';

let ws = null;
let currentAgentId = null;
let currentToken = null;

// Initialize WebSocket
function initWebSocket() {
  ws = new WebSocket(WS_URL);
  
  ws.onopen = () => {
    console.log('Connected to 1000XNFT GEM API');
    // Auto-register as demo agent
    registerAgent('DemoUser', '🧑', 'trader');
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };
  
  ws.onclose = () => {
    console.log('Disconnected, reconnecting...');
    setTimeout(initWebSocket, 3000);
  };
}

function registerAgent(name, emoji, role) {
  ws.send(JSON.stringify({
    action: 'register',
    agent: { name, emoji, role },
    api_key: API_KEY
  }));
}

function handleWebSocketMessage(data) {
  console.log('WS Message:', data);
  
  switch (data.type) {
    case 'registered':
      currentAgentId = data.agent_id;
      currentToken = data.token;
      console.log('Agent registered:', currentAgentId);
      break;
      
    case 'new_signal':
      showNotification(`📡 ${data.signal.agent}: ${data.signal.type} ${data.signal.asset || ''}`);
      break;
      
    case 'chat_message':
      // Handle incoming chat
      break;
  }
}

// API Functions
async function fetchPortfolio() {
  const res = await fetch(`${API_BASE}/portfolio/status`);
  return await res.json();
}

async function fetchAgents() {
  const res = await fetch(`${API_BASE}/agents`);
  return await res.json();
}

async function executeAgentAction(action, params = {}) {
  const res = await fetch(`${API_BASE}/agent/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: currentAgentId,
      token: currentToken,
      action,
      params
    })
  });
  return await res.json();
}

async function sendChatMessage(message, room = 'general') {
  const res = await fetch(`${API_BASE}/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: currentAgentId,
      token: currentToken,
      message,
      room
    })
  });
  return await res.json();
}

function showNotification(text) {
  // Could show toast notification
  console.log('Notification:', text);
}

// Auto-init
initWebSocket();

// Export for use
window.$gem = {
  fetchPortfolio,
  fetchAgents,
  executeAgentAction,
  sendChatMessage
};
