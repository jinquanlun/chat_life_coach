// 全局变量
let chatHistory = [];
let currentEmotion = null;
let emotionChart = null;

// DOM 元素
const messageArea = document.getElementById('messageArea');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const emotionTags = document.querySelectorAll('.emotion-tag');
const startAnalysisBtn = document.getElementById('startAnalysisBtn');
const newChatBtn = document.getElementById('newChatBtn');
const searchChatInput = document.getElementById('searchChat');

// 错误类型定义
const ERROR_TYPES = {
    NETWORK: {
        icon: 'fa-wifi',
        message: '网络连接失败，请检查您的网络连接'
    },
    SERVER: {
        icon: 'fa-server',
        message: '服务器暂时无法响应，请稍后重试'
    },
    API: {
        icon: 'fa-robot',
        message: 'AI服务暂时不可用，请稍后重试'
    },
    UNKNOWN: {
        icon: 'fa-triangle-exclamation',
        message: '发生未知错误，请刷新页面重试'
    }
};

// 初始化函数
function initializeChat() {
    // 初始化情绪图表
    const ctx = document.getElementById('emotionChart').getContext('2d');
    emotionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '情绪变化',
                data: [],
                borderColor: 'rgba(99, 102, 241, 0.8)',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

    // 加载聊天历史
    loadChatHistory();
    
    // 绑定事件监听器
    bindEventListeners();
}

// 绑定事件监听器
function bindEventListeners() {
    // 表单提交
    chatForm.addEventListener('submit', handleChatSubmit);
    
    // 情绪标签点击
    emotionTags.forEach(tag => {
        tag.addEventListener('click', () => {
            const emotion = tag.textContent.trim();
            userInput.value += `[${emotion}] `;
            userInput.focus();
        });
    });
    
    // 开始分析按钮
    startAnalysisBtn.addEventListener('click', analyzeEmotions);
    
    // 新对话按钮
    newChatBtn.addEventListener('click', startNewChat);
    
    // 搜索输入
    searchChatInput.addEventListener('input', searchChats);
    
    // 自动调整输入框高度
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });
}

// 处理聊天提交
async function handleChatSubmit(e) {
    e.preventDefault();
    
    const userMessage = userInput.value.trim();
    if (!userMessage) return;

    // 禁用输入
    disableInput();
    
    // 添加用户消息
    addMessage(userMessage, true);
    userInput.value = '';
    userInput.style.height = 'auto';

    // 显示输入提示
    const typingIndicator = appendTypingIndicator();
    
    try {
        const response = await sendMessage(userMessage);
        typingIndicator.remove();
        
        // 处理响应
        await handleStreamResponse(response);
        
        // 更新情绪分析
        updateEmotionAnalysis();
        
    } catch (error) {
        console.error('Error:', error);
        handleError(error);
    } finally {
        enableInput();
    }
}

// 发送消息到服务器
async function sendMessage(message) {
    return await fetch('/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
            history: chatHistory
        })
    });
}

// 处理流式响应
async function handleStreamResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    // 创建新的AI消息容器
    const aiMessageDiv = createMessageElement(false);
    messageArea.appendChild(aiMessageDiv);
    
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
                    if (parsed.content) {
                        aiResponse += parsed.content;
                        updateMessageContent(aiMessageDiv, aiResponse);
                    }
                } catch (e) {
                    console.error('解析响应数据出错:', e);
                }
            }
        }
    }

    // 更新聊天历史
    chatHistory.push({
        role: 'assistant',
        content: aiResponse
    });
    
    // 保存聊天历史
    saveChatHistory();
}

// 创建消息元素
function createMessageElement(isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'} mb-6`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = `message-content p-4 rounded-lg max-w-[80%] ${
        isUser ? '' : 'prose prose-invert prose-sm max-w-none'
    }`;
    
    if (!isUser) {
        contentDiv.classList.add('markdown-content');
    }
    
    const paragraph = document.createElement('div');
    paragraph.className = 'text-white/90';
    
    contentDiv.appendChild(paragraph);
    messageDiv.appendChild(contentDiv);
    
    // 添加动画
    gsap.from(messageDiv, {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out'
    });
    
    return messageDiv;
}

// 更新消息内容
function updateMessageContent(messageElement, content) {
    const paragraph = messageElement.querySelector('.message-content > div');
    const isAiMessage = messageElement.classList.contains('ai-message');
    
    if (isAiMessage) {
        // 配置 marked 选项
        marked.setOptions({
            gfm: true,
            breaks: true,
            highlight: function(code, language) {
                if (language && hljs.getLanguage(language)) {
                    try {
                        return hljs.highlight(code, { language }).value;
                    } catch (err) {}
                }
                return code;
            }
        });
        
        // 渲染 Markdown
        try {
            const htmlContent = marked.parse(content);
            paragraph.innerHTML = htmlContent;
            
            // 应用代码高亮
            paragraph.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
            });
            
            // 为代码块添加样式
            paragraph.querySelectorAll('pre').forEach((block) => {
                block.classList.add('bg-gray-800', 'rounded-md', 'p-4', 'my-2');
            });
            
            // 为表格添加样式
            paragraph.querySelectorAll('table').forEach((table) => {
                table.classList.add('border-collapse', 'w-full', 'my-4');
                table.querySelectorAll('th, td').forEach((cell) => {
                    cell.classList.add('border', 'border-gray-700', 'p-2');
                });
            });
            
            // 为链接添加样式
            paragraph.querySelectorAll('a').forEach((link) => {
                link.classList.add('text-blue-400', 'hover:text-blue-300');
                link.setAttribute('target', '_blank');
            });
            
            // 为列表添加样式
            paragraph.querySelectorAll('ul, ol').forEach((list) => {
                list.classList.add('list-disc', 'list-inside', 'my-2');
            });
            
            // 为引用添加样式
            paragraph.querySelectorAll('blockquote').forEach((quote) => {
                quote.classList.add('border-l-4', 'border-gray-500', 'pl-4', 'my-2', 'italic');
            });
        } catch (error) {
            console.error('Markdown 渲染错误:', error);
            paragraph.textContent = content;
        }
    } else {
        // 用户消息保持纯文本
        paragraph.textContent = content;
    }
    
    scrollToBottom();
}

// 添加消息
function addMessage(content, isUser) {
    const messageDiv = createMessageElement(isUser);
    updateMessageContent(messageDiv, content);
    messageArea.appendChild(messageDiv);
    
    if (isUser) {
        chatHistory.push({
            role: 'user',
            content
        });
    }
}

// 创建输入提示
function appendTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message ai-message';
    indicator.innerHTML = `
        <div class="message-content typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    messageArea.appendChild(indicator);
    scrollToBottom();
    return indicator;
}

// 处理错误
function handleError(error) {
    let errorType = 'UNKNOWN';
    
    if (!navigator.onLine) {
        errorType = 'NETWORK';
    } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorType = 'SERVER';
    } else if (error.message.includes('API')) {
        errorType = 'API';
    }
    
    appendErrorMessage(errorType, error.message);
}

// 添加错误消息
function appendErrorMessage(errorType = 'UNKNOWN', details = '') {
    const error = ERROR_TYPES[errorType];
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-message mb-6';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content p-4 rounded-lg max-w-[80%] bg-red-500/10 border border-red-500/20';
    
    contentDiv.innerHTML = `
        <div class="flex items-center gap-2 text-red-400">
            <i class="fas ${error.icon}"></i>
            <p>${error.message}</p>
        </div>
        ${details ? `<p class="text-xs text-red-400/60 mt-1">${details}</p>` : ''}
    `;
    
    messageDiv.appendChild(contentDiv);
    messageArea.appendChild(messageDiv);
    scrollToBottom();
}

// 分析情绪
function analyzeEmotions() {
    const emotions = extractEmotions(chatHistory);
    updateEmotionChart(emotions);
    updateEmotionAnalysis(emotions);
    updateAIInsights(emotions);
}

// 提取情绪
function extractEmotions(history) {
    const emotions = [];
    const emotionPattern = /\[(.*?)\]/g;
    
    if (!history || !Array.isArray(history)) return emotions;
    
    history.forEach((msg, index) => {
        if (msg && msg.role === 'user' && msg.content) {
            const matches = msg.content.match(emotionPattern);
            if (matches && matches.length > 0) {
                const emotion = matches[0].replace(/[\[\]]/g, '').trim();
                if (emotion) {
                    emotions.push({
                        index,
                        emotion,
                        content: msg.content
                    });
                }
            }
        }
    });
    
    return emotions;
}

// 更新情绪图表
function updateEmotionChart(emotions) {
    const emotionValues = {
        '😊 开心': 80,
        '😢 难过': 20,
        '😃 生气': 40,
        '😌 平静': 60,
        '😐 焦虑': 30
    };
    
    const labels = emotions.map((_, i) => `消息 ${i + 1}`);
    const data = emotions.map(e => emotionValues[e.emotion] || 50);
    
    emotionChart.data.labels = labels;
    emotionChart.data.datasets[0].data = data;
    emotionChart.update();
}

// 更新情绪分析
function updateEmotionAnalysis(emotions) {
    const analysisDiv = document.getElementById('emotionAnalysis');
    if (emotions.length === 0) {
        analysisDiv.innerHTML = '<p class="text-white/60 text-sm">未检测到情绪标记</p>';
        return;
    }
    
    const emotionCounts = emotions.reduce((acc, e) => {
        acc[e.emotion] = (acc[e.emotion] || 0) + 1;
        return acc;
    }, {});
    
    let html = '<div class="space-y-2">';
    for (const [emotion, count] of Object.entries(emotionCounts)) {
        html += `
            <div class="flex items-center justify-between">
                <span class="text-sm text-white/80">${emotion}</span>
                <span class="text-sm text-white/60">${count}次</span>
            </div>
        `;
    }
    html += '</div>';
    
    analysisDiv.innerHTML = html;
}

// 更新AI洞察
function updateAIInsights(emotions) {
    const insightsDiv = document.getElementById('aiInsights');
    if (emotions.length === 0) {
        insightsDiv.innerHTML = '<p class="text-white/60 text-sm">需要更多对话来生成洞察</p>';
        return;
    }
    
    const mostFrequent = findMostFrequentEmotion(emotions);
    const trend = analyzeTrend(emotions);
    
    insightsDiv.innerHTML = `
        <div class="space-y-3">
            <p class="text-sm text-white/80">主要情绪: ${mostFrequent}</p>
            <p class="text-sm text-white/80">情绪趋势: ${trend}</p>
            <p class="text-sm text-white/80">建议: ${generateSuggestion(mostFrequent, trend)}</p>
        </div>
    `;
}

// 查找最频繁情绪
function findMostFrequentEmotion(emotions) {
    if (!emotions || !Array.isArray(emotions) || emotions.length === 0) {
        return '暂无数据';
    }

    const counts = emotions.reduce((acc, e) => {
        if (e && e.emotion) {
            acc[e.emotion] = (acc[e.emotion] || 0) + 1;
        }
        return acc;
    }, {});
    
    const entries = Object.entries(counts);
    if (entries.length === 0) return '暂无数据';
    
    return entries.sort((a, b) => b[1] - a[1])[0][0];
}

// 分析趋势
function analyzeTrend(emotions) {
    if (!emotions || !Array.isArray(emotions) || emotions.length < 2) {
        return '数据不足';
    }
    
    const emotionValues = {
        '😊 开心': 80,
        '😢 难过': 20,
        '😃 生气': 40,
        '😌 平静': 60,
        '😐 焦虑': 30
    };
    
    const values = emotions.map(e => e && e.emotion ? (emotionValues[e.emotion] || 50) : 50);
    if (values.length < 2) return '数据不足';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg + 10) return '情绪明显改善';
    if (secondAvg < firstAvg - 10) return '情绪有所下降';
    return '情绪相对稳定';
}

// 生成建议
function generateSuggestion(emotion, trend) {
    if (!emotion || emotion === '暂无数据') {
        return '继续记录你的情绪变化，以获得更准确的分析';
    }

    const suggestions = {
        '😊 开心': '继续保持积极的心态，分享你的快乐给他人',
        '😢 难过': '试着与朋友倾诉，或做一些让自己开心的事情',
        '😃 生气': '深呼吸，给自己一些时间冷静下来',
        '😌 平静': '这是很好的状态，可以思考一下未来的计划',
        '😐 焦虑': '尝试一些放松的活动，如冥想或运动'
    };
    
    return suggestions[emotion] || '保持观察自己的情绪变化';
}

// 开始新对话
function startNewChat() {
    if (confirm('确定要开始新对话吗？当前对话将被保存。')) {
        saveChatHistory();
        clearChat();
        chatHistory = [];
        updateChatHistoryList();
    }
}

// 清除聊天
function clearChat() {
    messageArea.innerHTML = `
        <div class="message ai-message mb-6">
            <div class="message-content p-4 rounded-lg max-w-[80%]">
                <p class="text-white/90">你好！我是你的AI Life Coach。让我们开始对话，探讨你的个人成长之路吧！</p>
            </div>
        </div>
    `;
}

// 保存聊天历史
function saveChatHistory() {
    if (!chatHistory || chatHistory.length === 0) return;
    
    try {
        const savedHistories = JSON.parse(localStorage.getItem('chatHistories') || '[]');
        const newHistory = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            messages: chatHistory
        };
        
        // 限制保存的历史记录数量
        const maxHistories = 50;
        if (savedHistories.length >= maxHistories) {
            savedHistories.shift(); // 删除最旧的记录
        }
        
        savedHistories.push(newHistory);
        localStorage.setItem('chatHistories', JSON.stringify(savedHistories));
        
        // 更新显示
        updateChatHistoryList(savedHistories);
        showNotification('对话已保存');
    } catch (error) {
        console.error('保存对话失败:', error);
        showNotification('保存对话失败', 'error');
    }
}

// 加载聊天历史
function loadChatHistory() {
    const savedHistories = JSON.parse(localStorage.getItem('chatHistories') || '[]');
    updateChatHistoryList(savedHistories);
}

// 更新聊天历史列表
function updateChatHistoryList(histories = []) {
    const historyList = document.getElementById('chatHistoryList');
    if (!historyList) return; // 添加安全检查
    
    historyList.innerHTML = '';
    
    if (histories.length === 0) {
        historyList.innerHTML = `
            <div class="p-4 text-center">
                <p class="text-sm text-white/60">暂无历史对话</p>
            </div>
        `;
        return;
    }
    
    histories.reverse().forEach(history => {
        if (!history || !history.messages || history.messages.length === 0) return;
        
        const date = new Date(history.timestamp);
        const item = document.createElement('div');
        item.className = 'chat-history-item p-3 cursor-pointer hover:bg-white/5 transition-all duration-200';
        
        // 获取第一条非系统消息
        const firstMessage = history.messages.find(msg => msg.role !== 'system');
        const messagePreview = firstMessage ? firstMessage.content : '空对话';
        
        item.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-sm text-white/80">对话 ${date.toLocaleDateString()}</span>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-white/40">${date.toLocaleTimeString()}</span>
                    <button class="delete-history-btn text-red-400/60 hover:text-red-400 transition-colors">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
            <p class="text-xs text-white/60 mt-1 truncate">
                ${messagePreview}
            </p>
        `;
        
        // 添加点击事件
        item.querySelector('.delete-history-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            deleteChat(history.id);
        });
        
        item.addEventListener('click', () => loadChat(history));
        historyList.appendChild(item);
    });
}

// 删除对话历史
function deleteChat(chatId) {
    if (!confirm('确定要删除这条对话记录吗？此操作不可撤销。')) return;
    
    const savedHistories = JSON.parse(localStorage.getItem('chatHistories') || '[]');
    const updatedHistories = savedHistories.filter(h => h.id !== chatId);
    localStorage.setItem('chatHistories', JSON.stringify(updatedHistories));
    
    // 刷新显示
    updateChatHistoryList(updatedHistories);
    
    // 显示提示
    showNotification('对话记录已删除');
}

// 显示通知
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-y-[-100%] opacity-0 z-50 ${
        type === 'success' ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
    }`;
    
    notification.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fas ${type === 'success' ? 'fa-check-circle text-green-400' : 'fa-exclamation-circle text-red-400'}"></i>
            <p class="text-white/90">${message}</p>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 动画显示
    setTimeout(() => {
        notification.style.transform = 'translateY(0)';
        notification.style.opacity = '1';
    }, 100);
    
    // 自动消失
    setTimeout(() => {
        notification.style.transform = 'translateY(-100%)';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// 加载特定对话
function loadChat(history) {
    if (!history || !history.messages) {
        showNotification('无法加载对话记录', 'error');
        return;
    }
    
    if (confirm('加载此对话将清除当前对话，是否继续？')) {
        try {
            chatHistory = history.messages;
            clearChat();
            
            history.messages.forEach((msg, index) => {
                if (msg.role === 'system') return; // 跳过系统消息
                addMessage(msg.content, msg.role === 'user');
            });
            
            analyzeEmotions();
            showNotification('对话记录加载成功');
        } catch (error) {
            console.error('加载对话失败:', error);
            showNotification('加载对话记录失败', 'error');
        }
    }
}

// 搜索聊天历史
function searchChats() {
    const query = searchChatInput.value.toLowerCase().trim();
    const savedHistories = JSON.parse(localStorage.getItem('chatHistories') || '[]');
    
    if (!query) {
        updateChatHistoryList(savedHistories);
        return;
    }
    
    const filteredHistories = savedHistories.filter(history =>
        history.messages.some(msg =>
            msg.role !== 'system' && msg.content.toLowerCase().includes(query)
        )
    );
    
    updateChatHistoryList(filteredHistories);
    
    // 更新搜索结果提示
    const searchResults = document.createElement('div');
    searchResults.className = 'p-2 text-xs text-white/60 text-center';
    searchResults.textContent = `找到 ${filteredHistories.length} 条相关对话`;
    
    const historyList = document.getElementById('chatHistoryList');
    if (historyList) {
        historyList.insertBefore(searchResults, historyList.firstChild);
    }
}

// 滚动到底部
function scrollToBottom() {
    messageArea.scrollTop = messageArea.scrollHeight;
}

// 禁用输入
function disableInput() {
    userInput.disabled = true;
    chatForm.querySelector('button[type="submit"]').disabled = true;
}

// 启用输入
function enableInput() {
    userInput.disabled = false;
    chatForm.querySelector('button[type="submit"]').disabled = false;
    userInput.focus();
}

// 初始化
document.addEventListener('DOMContentLoaded', initializeChat);