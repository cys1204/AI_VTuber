const chatBox = document.getElementById('chat');
const llmBox = document.getElementById('llm-replies');
const ws = new WebSocket('wss://london-preterlegal-sandfly.ngrok-free.dev'); // 換成ngrok的網址

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  // 顯示使用者留言
  if (msg.username !== '虛擬人') {
    chatBox.innerHTML += `[${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.username}: ${msg.content}\n`;
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // 測試虛擬人回覆
  if (msg.username === '虛擬人') {
    llmBox.innerHTML += `[${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.content}\n`;
    llmBox.scrollTop = llmBox.scrollHeight;
  }
};

document.getElementById('send').onclick = () => {
  const username = document.getElementById('username').value.trim() || '匿名';
  const content = document.getElementById('message').value.trim();
  if (!content) return;
  ws.send(JSON.stringify({ username, content }));
  document.getElementById('message').value = '';
};
