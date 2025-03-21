// 导入所需模块
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();

// 启用CORS和JSON解析
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// API配置
const API_KEY = process.env.API_KEY || 'fa52e00b-af7f-4efa-9444-2fa932b9e4a0';
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

// 系统提示词设置
const SYSTEM_PROMPT = `你是一位专业的Life Coach，拥有丰富的个人成长和生活指导经验。你的目标是：
1. 通过倾听和提问，深入理解用户的困扰和需求
2. 提供具体、可行的建议和解决方案
3. 鼓励用户积极思考和行动
4. 保持专业、温和的对话态度
5. 在必要时提醒用户寻求专业帮助

请记住：你的建议应该是建设性的，但不应该替代专业医疗或心理咨询。`;

// 处理聊天请求
app.post('/chat', async (req, res) => {
    let hasError = false;

    try {
        const userMessage = req.body.message;
        const chatHistory = req.body.history || [];

        // 构建消息历史
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...chatHistory,
            { role: 'user', content: userMessage }
        ];

        // 设置API请求选项
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-r1-250120',
                messages: messages,
                stream: true,
                temperature: 0.6
            })
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }

        // 设置SSE响应头
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // 获取响应流
        const reader = response.body;
        const decoder = new TextDecoder();

        // 处理数据块
        for await (const chunk of reader) {
            if (hasError) break;

            const lines = decoder.decode(chunk).split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        res.write('data: [DONE]\n\n');
                        continue;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0].delta.content || '';
                        if (content) {
                            res.write(`data: ${JSON.stringify({ content })}\n\n`);
                        }
                    } catch (e) {
                        console.error('解析响应数据出错:', e);
                    }
                }
            }
        }

        res.end();
    } catch (error) {
        console.error('处理请求出错:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: '服务器内部错误' });
        }
        hasError = true;
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: true,
        message: '服务器内部错误，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 优化服务器启动
const startServer = async (initialPort = 3000) => {
    let port = initialPort;
    const maxRetries = 10; // 最多尝试10个端口

    for (let i = 0; i < maxRetries; i++) {
        try {
            await new Promise((resolve, reject) => {
                const server = app.listen(port, () => {
                    console.log(`服务器启动成功，访问 http://localhost:${port}`);
                    resolve();
                });

                server.on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        console.log(`端口 ${port} 已被占用，尝试端口 ${port + 1}`);
                        port++;
                        server.close();
                        reject(err);
                    } else {
                        console.error('服务器启动失败:', err);
                        reject(err);
                    }
                });
            });
            // 如果成功启动，跳出循环
            break;
        } catch (error) {
            if (i === maxRetries - 1) {
                console.error(`无法找到可用端口，请手动关闭占用端口的程序`);
                process.exit(1);
            }
            // 如果不是最后一次尝试，继续循环
            continue;
        }
    }
};

startServer(process.env.PORT || 3000);