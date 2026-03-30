import React from 'react';

export default function MessageInput({ username, setUsername, message, setMessage, onSend }) {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') onSend();
  };

  return (
    <div style={{ marginTop: '10px' }}>
      <input
        placeholder="你的名字"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={{ marginRight: '5px' }}
      />
      <input
        placeholder="輸入訊息"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyPress}
        style={{ marginRight: '5px', width: '300px' }}
      />
      <button onClick={onSend}>送出</button>
    </div>
  );
}
