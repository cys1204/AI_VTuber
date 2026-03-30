const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 靜態檔案
app.use(express.static(path.join(__dirname, 'public')));

// SQLite DB
const db = new sqlite3.Database('chat.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    username TEXT,
    content TEXT,
    timestamp INTEGER,
    replied INTEGER DEFAULT 0
  )`);
});

// 產生 timestamp + sequence ID
let sequence = 0;
function generateId() {
  const ts = Date.now();
  const id = `${ts}-${sequence}`;
  sequence = (sequence + 1) % 10000;
  return id;
}

// WebSocket 廣播
function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// WebSocket 連線
wss.on('connection', (ws) => {
  console.log('新使用者連線');

  db.all('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 20', [], (err, rows) => {
    if (!err) {
      rows.reverse().forEach(row => ws.send(JSON.stringify(row)));
    }
  });

  ws.on('message', (message) => {
    const { username, content } = JSON.parse(message);
    const id = generateId();
    const timestamp = Date.now();

    // 只做插入，不要立即回覆
    const msgObj = { id, username, content, timestamp, replied: 0 };
    db.run(
      'INSERT INTO messages (id, username, content, timestamp, replied) VALUES (?, ?, ?, ?, ?)',
      [id, username, content, timestamp, 0]
    );
    broadcast(msgObj);
  });
});


// =============== 定期回覆 ===============

const LLM_MIN_INTERVAL = 5000;   // 5 sec
const LLM_MAX_INTERVAL = 15000;  // 15 sec
const MAX_AGE_MS = 1000 * 60 * 60; // Only reply to messages within the last hour

async function getGroqReply(message) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: '你是一個虛擬人，正在一個即時聊天室中與使用者互動。請用繁體中文回答，語氣自然，不要太長。'
        },
        {
          role: 'user',
          content: `${message.username} 說: ${message.content}`
        }
      ],
      model: GROQ_MODEL
    });

    return completion.choices[0]?.message?.content || '(虛擬人似乎在發呆...)';

  } catch (error) {
    console.error('Groq API Error:', error);
    return '(虛擬人連線不穩...)';
  }
}

async function scheduleLLMReply() {
  const interval = Math.random() * (LLM_MAX_INTERVAL - LLM_MIN_INTERVAL) + LLM_MIN_INTERVAL;

  setTimeout(() => {
    const now = Date.now();

    // 抓未回覆訊息
    db.all(
      'SELECT * FROM messages WHERE replied = 0 AND timestamp >= ? ORDER BY timestamp DESC LIMIT 50',
      [now - MAX_AGE_MS],
      async (err, rows) => {

        if (err || rows.length === 0) {
          scheduleLLMReply();
          return;
        }

        // 隨機挑一則未回覆的訊息
        const msg = rows[Math.floor(Math.random() * rows.length)];

        // 向 LLM 請求回覆
        const originalReply = await getGroqReply(msg);
        const replyContent = `${msg.username}說了${msg.content}。   ${originalReply}`;


        const id = generateId();
        const timestamp = Date.now();
        const replyObj = { id, username: '虛擬人', content: replyContent, timestamp, replied: 1 };

        // 標記原訊息已回覆
        db.run('UPDATE messages SET replied = 1 WHERE id = ?', [msg.id]);

        // 儲存回覆
        db.run(
          'INSERT INTO messages (id, username, content, timestamp, replied) VALUES (?, ?, ?, ?, ?)',
          [id, '虛擬人', replyContent, timestamp, 1]
        );

        // WebSocket 廣播
        broadcast(replyObj);

        // 再排下一次
        scheduleLLMReply();
      }
    );
  }, interval);
}

// 啟動排程
scheduleLLMReply();

// =============================================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
