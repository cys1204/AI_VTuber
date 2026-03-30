import React, { useEffect, useRef } from 'react';

export default function ChatBox({ messages }) {
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div
      style={{
        width: '100%',
        height: '300px',
        border: '1px solid #ccc',
        overflowY: 'scroll',
        padding: '5px',
        whiteSpace: 'pre-wrap',
      }}
    >
      {messages.map(msg => (
        <div key={msg.id}>
          [{new Date(msg.timestamp).toLocaleTimeString()}] {msg.username}: {msg.content}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
