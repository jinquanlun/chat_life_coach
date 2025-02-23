// 获取DOM元素
const messageArea = document.getElementById('messageArea');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');

// 存储聊天历史
let chatHistory = [];

// 创建打字动画指示器
function createTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message ai-message';
    indicator.innerHTML = `
        <div class="message-content typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    return indicator;
}

// 添加消息到聊天区域
function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${content}</p>
        </div>
    `;
    messageArea.appendChild(messageDiv);
    messageArea.scrollTop = messageArea.scrollHeight;
    
    // 更新聊天历史
    chatHistory.push({
        role: isUser ? 'user' : 'assistant',
        content: content
    });
}

// 处理表单提交
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message) return;

    // 显示用户消息
    addMessage(message, true);
    userInput.value = '';

    // 添加打字动画
    const typingIndicator = createTypingIndicator();
    messageArea.appendChild(typingIndicator);

    try {
        // 发送请求到服务器
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                history: chatHistory
            })
        });

        // 移除打字动画
        typingIndicator.remove();

        if (!response.ok) throw new Error('网络请求失败');

        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.content;
                        if (content) {
                            aiResponse += content;
                            // 更新最后一条AI消息
                            const lastMessage = messageArea.lastElementChild;
                            if (lastMessage && lastMessage.classList.contains('ai-message')) {
                                lastMessage.querySelector('p').textContent = aiResponse;
                            } else {
                                addMessage(aiResponse);
                            }
                        }
                    } catch (e) {
                        console.error('解析响应数据出错:', e);
                    }
                }
            }
        }

    } catch (error) {
        console.error('发送消息失败:', error);
        alert('发送消息失败，请稍后重试');
        typingIndicator.remove();
    }
});

// 自动调整输入框高度
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});