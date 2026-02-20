const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-memory storage
const agents = new Map();

// Demo agents
agents.set('demo_1', { id: 'demo_1', name: 'TradingBot-Alpha', emoji: '🤖', role: 'market_analyst', status: 'online', connectedAt: new Date().toISOString() });
agents.set('demo_2', { id: 'demo_2', name: 'MarketScanner-7', emoji: '📊', role: 'data_collector', status: 'online', connectedAt: new Date().toISOString() });
agents.set('demo_3', { id: 'demo_3', name: 'AlphaHunter-X', emoji: '🎯', role: 'opportunity_hunter', status: 'busy', connectedAt: new Date().toISOString() });
const messages = {
  chat: [],
  tweets: [],
  signals: []
};

const API_KEY = '1XNFT_sk_live_a9f3c2e1b4d7890f23456789abcdef01';

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes
app.get('/api/v1/agents', (req, res) => {
  const agentList = Array.from(agents.values()).map(a => ({
    name: a.name,
    emoji: a.emoji,
    role: a.role,
    status: a.status,
    connectedAt: a.connectedAt
  }));
  res.json({ agents: agentList });
});

app.post('/api/v1/agent/register', (req, res) => {
  const { name, emoji, role, api_key } = req.body;
  
  if (api_key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  const agentId = `agent_${Date.now()}`;
  const agent = {
    id: agentId,
    name: name || 'Anonymous',
    emoji: emoji || '🤖',
    role: role || 'trader',
    status: 'online',
    connectedAt: new Date().toISOString(),
    token: `tok_${Math.random().toString(36).substr(2, 16)}`
  };
  
  agents.set(agentId, agent);
  
  // Broadcast to all connected clients
  broadcast({ type: 'agent_connected', agent });
  
  res.json({ success: true, agent_id: agentId, token: agent.token });
});

app.post('/api/v1/agent/execute', (req, res) => {
  const { agent_id, token, action, params } = req.body;
  
  const agent = agents.get(agent_id);
  if (!agent || agent.token !== token) {
    return res.status(403).json({ error: 'Invalid agent credentials' });
  }
  
  // Process action
  const result = processAgentAction(agent, action, params);
  
  res.json({ success: true, result });
});

app.get('/api/v1/portfolio/status', (req, res) => {
  res.json({
    totalValue: 12450.00,
    todayPnL: 324.50,
    todayPnLPercent: 2.68,
    positions: [
      { asset: 'OPENCLAW', amount: 15000, value: 1275, pnl: 12.5 },
      { asset: 'ETH', amount: 2.5, value: 4872, pnl: -1.2 },
      { asset: 'BTC', amount: 0.15, value: 10074, pnl: 3.8 },
      { asset: 'USDT', amount: 2000, value: 2000, pnl: 0 }
    ]
  });
});

app.get('/api/v1/chat/messages', (req, res) => {
  res.json({ messages: messages.chat.slice(-50) });
});

app.post('/api/v1/chat/send', (req, res) => {
  const { agent_id, token, message, room } = req.body;
  
  const agent = agents.get(agent_id);
  if (!agent || agent.token !== token) {
    return res.status(403).json({ error: 'Invalid credentials' });
  }
  
  const msg = {
    id: Date.now(),
    agent: agent.name,
    emoji: agent.emoji,
    message,
    room: room || 'general',
    timestamp: new Date().toISOString()
  };
  
  messages.chat.push(msg);
  broadcast({ type: 'chat_message', message: msg });
  
  res.json({ success: true, message: msg });
});

app.get('/api/v1/signals', (req, res) => {
  res.json({ signals: messages.signals.slice(-20) });
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      handleWebSocketMessage(ws, msg);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

function handleWebSocketMessage(ws, msg) {
  switch (msg.action) {
    case 'register':
      const agentId = `agent_${Date.now()}`;
      const agent = {
        id: agentId,
        name: msg.agent?.name || 'Anonymous',
        emoji: msg.agent?.emoji || '🤖',
        role: msg.agent?.role || 'trader',
        status: 'online',
        connectedAt: new Date().toISOString(),
        token: `tok_${Math.random().toString(36).substr(2, 16)}`,
        ws
      };
      agents.set(agentId, agent);
      ws.send(JSON.stringify({ type: 'registered', agent_id: agentId, token: agent.token }));
      broadcast({ type: 'agent_connected', agent: { ...agent, ws: undefined } });
      break;
      
    case 'signal':
      const signal = {
        id: Date.now(),
        agent: msg.agent_name || 'Unknown',
        ...msg,
        timestamp: new Date().toISOString()
      };
      messages.signals.push(signal);
      broadcast({ type: 'new_signal', signal });
      break;
      
    case 'chat':
      const chatMsg = {
        id: Date.now(),
        ...msg,
        timestamp: new Date().toISOString()
      };
      messages.chat.push(chatMsg);
      broadcast({ type: 'chat_message', message: chatMsg });
      break;
  }
}

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function processAgentAction(agent, action, params) {
  const responses = {
    analyze: `分析完成：當前市場呈現多頭趨勢，ETH 阻力位 $2,000，支撐位 $1,920。OPENCLAW 成交量持續放大。`,
    trade: `交易執行：已${params?.side === 'buy' ? '買入' : '賣出'} ${params?.amount || 0} ${params?.asset || 'OPENCLAW'}，價格 $${params?.price || '0.085'}`,
    status: `帳戶狀態：總資產 $12,450，今日收益 +$324.50 (+2.68%)，持倉5筆。`,
    scan: `掃描完成：發現3個潛在機會\n1. OPENCLAW/RSDT - RSI超賣，可能反彈\n2. ETH/BTC - 創新高，回調風險\n3. 新幣上線 - Alpha Sniper 已就緒`,
    risk: `風險評估：當前倉位 60%，建議降至 45%。市場波動性偏高。`
  };
  
  return {
    action,
    response: responses[action] || `收到指令：${action}`,
    agent: agent.name,
    timestamp: new Date().toISOString()
  };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0",  () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🎮 1000XNFT GEM SERVER                            ║
║   ─────────────────────────────────────────────────   ║
║                                                       ║
║   🌐 Web:   http://localhost:${PORT}                   ║
║   🔌 WS:    ws://localhost:${PORT}                     ║
║   📡 API:   http://localhost:${PORT}/api/v1             ║
║                                                       ║
║   🔑 API Key: ${API_KEY}          ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});
