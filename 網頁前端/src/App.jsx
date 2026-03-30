import React, { useEffect, useRef, useState } from 'react'
import AvatarViewer from './components/AvatarViewer'

const WS_URL = 'ws://localhost:3000'; // replace with actual URL

export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [username, setUsername] = useState('')
  const [subtitle, setSubtitle] = useState('Ready to Chat!')
  const wsRef = useRef(null)
  const messagesEndRef = useRef(null)
  const avatarRef = useRef(null)
  const onMessageHandlerRef = useRef(null);
  
  useEffect(() => {
    onMessageHandlerRef.current = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'history') {
        const historyMessages = msg.data.map(item => ({ sender: item.username, text: item.content }));
        setMessages(historyMessages);
        return;
      }

      const formattedMsg = { sender: msg.username, text: msg.content };
      const myName = username.trim() || '匿名';

      if (formattedMsg.sender !== myName) {
        setMessages(prev => [...prev, formattedMsg]);
        if (formattedMsg.sender === '虛擬人') {
          setSubtitle(formattedMsg.text);
          avatarRef.current?.speak(formattedMsg.text);
        }
      }
    };
  });
  
  useEffect(() => {
    wsRef.current = new WebSocket(WS_URL);
    
    wsRef.current.onopen = () => console.log('Connected to server');
    wsRef.current.onclose = () => console.log('Disconnected from server');
    wsRef.current.onerror = (err) => console.error('WebSocket error:', err);
    
    wsRef.current.onmessage = (event) => onMessageHandlerRef.current(event);
    
    return () => {
      if (wsRef.current) {
        wsRef.current.onmessage = null;
        wsRef.current.close();
      }
    };
  }, []);
  
  useEffect(() => {
    if(messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  const sendMessage = () => {
    const textToSend = input.trim();
    if (!textToSend || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const senderName = username.trim() || '匿名';
    const messagePayload = JSON.stringify({ username: senderName, content: textToSend });
    wsRef.current.send(messagePayload);
    setMessages(prev => [...prev, {sender: senderName, text: textToSend }]);
    setInput("")
  }

  return (
    <div className="w-screen h-screen bg-gray-950 text-white flex">

      {/* Left: Virtual Human */}
      <div className="flex-1 relative border-r border-gray-800">
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black">
          <div className="w-3/4 h-3/4 bg-black rounded-2xl shadow-2xl flex items-center justify-center text-gray-400 border border-gray-700">
            <AvatarViewer ref={avatarRef} />
          </div>
        </div>

        {/* Subtitle */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-3xl font-semibold bg-black/60 px-6 py-3 rounded-3xl backdrop-blur-sm shadow-xl">
          {subtitle}
        </div>
      </div>

      {/* Right: Chat Panel */}
      <div className="w-96 bg-gray-900 flex flex-col">

        {/* Header */}
        <div className="p-4 border-b border-gray-800 text-lg font-bold tracking-wide bg-gray-850">Chat</div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${(username.trim() || '匿名') === msg.sender ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2 text-sm rounded-xl ${(username.trim() || '匿名') === msg.sender ? 'bg-gray-800' : 'bg-blue-600'}`}>
                <span className="text-gray-300 text-xs block mb-1">{msg.sender}</span>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-gray-800 bg-gray-850 flex items-center space-x-2">
          <input
            type="text"
            className="w-24 px-3 py-2 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Your Name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}