import React, { useEffect, useState, useRef } from 'react';
import ChatBox from './components/ChatBox.jsx';
import LLMBox from './components/LLMBox.jsx';
import MessageInput from './components/MessageInput.jsx';

const WS_URL = 'ws://localhost:3000'; // 換成ngrok的網址

export default function App() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [llmReplies, setLlmReplies] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    wsRef.current = new WebSocket(WS_URL);

    wsRef.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.username !== '虛擬人') {
        setChatMessages(prev => [...prev, msg]);
      } else {
        setLlmReplies(prev => [...prev, msg]);
      }
    };

    wsRef.current.onopen = () => console.log('Connected to WebSocket');
    wsRef.current.onerror = (err) => console.error('WebSocket error:', err);

    return () => wsRef.current.close();
  }, []);

  const sendMessage = () => {
    if (!message.trim()) return;
    const user = username.trim() || '匿名';
    wsRef.current.send(JSON.stringify({ username: user, content: message.trim() }));
    setMessage('');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h3>聊天室</h3>
      <ChatBox messages={chatMessages} />

      <h3>LLM 回覆測試區</h3>
      <LLMBox messages={llmReplies} />

      <MessageInput
        username={username}
        setUsername={setUsername}
        message={message}
        setMessage={setMessage}
        onSend={sendMessage}
      />
    </div>
  );
}
