import React, { useEffect, useRef } from 'react';

export default function LLMBox({ messages }) {
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
        height: '150px',
        border: '1px solid #aaa',
        overflowY: 'scroll',
        padding: '5px',
        whiteSpace: 'pre-wrap',
        backgroundColor: '#f9f9f9',
      }}
    >
      {messages.map(msg => (
        <div key={msg.id}>
          [{new Date(msg.timestamp).toLocaleTimeString()}] {msg.content}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
