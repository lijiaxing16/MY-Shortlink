// ============================================================
//  Short Link Generator ULTRA Edition (Cloudflare Worker)
// ============================================================

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // 1. 首页
        if (path === '/') {
            return handleHomePage();
        }

        // 2. 统计页面
        if (path === '/stats' || path.startsWith('/stats/')) {
            return handleStatsPage();
        }

        // 3. 管理页面
        if (path === '/manage') {
            return handleManagePage();
        }

        // 4. API 路由
        if (path.startsWith('/api/')) {
            return handleAPI(request, env, path);
        }

        // 5. 短链接访问
        if (path.length > 1) {
            return handleShortLink(request, env, ctx, path.substring(1));
        }

        return new Response('404 Not Found', { status: 404 });
    }
};

// 系统保留后缀
const RESERVED_PATHS = ['api', 'stats', 'manage', 'favicon.ico', 'robots.txt', 'admin'];

// 生成短码
function generateShortCode(length = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 格式化 URL
function formatUrl(string) {
    try {
        let str = string.trim();
        if (!/^https?:\/\//i.test(str)) {
            str = 'https://' + str;
        }
        new URL(str);
        return { isValid: true, url: str };
    } catch (_) {
        return { isValid: false, url: string };
    }
}

// 获取客户端 IP
function getClientIP(request) {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For')?.split(',')[0] || 
           request.headers.get('X-Real-IP') || 
           'unknown';
}

// ------------------------------------------------------------
// 🎨 公共样式 - 霓虹玻璃风格
// ------------------------------------------------------------
const COMMON_STYLE = `
    :root {
        --primary: #6C63FF;
        --primary-light: #8B83FF;
        --primary-dark: #4A42D9;
        --secondary: #FF6B6B;
        --success: #51CF66;
        --warning: #FFD93D;
        --info: #4DABF7;
        --bg-dark: #0a0a1a;
        --bg-card: rgba(255, 255, 255, 0.06);
        --text-primary: #ffffff;
        --text-secondary: rgba(255, 255, 255, 0.7);
        --text-muted: rgba(255, 255, 255, 0.4);
        --border-color: rgba(255, 255, 255, 0.1);
        --shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        --radius: 20px;
        --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    [data-theme="light"] {
        --bg-dark: #f0f2f5;
        --bg-card: rgba(255, 255, 255, 0.85);
        --text-primary: #1a1a2e;
        --text-secondary: rgba(0, 0, 0, 0.7);
        --text-muted: rgba(0, 0, 0, 0.4);
        --border-color: rgba(0, 0, 0, 0.1);
    }

    * { 
        margin: 0; 
        padding: 0; 
        box-sizing: border-box; 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', Roboto, sans-serif;
    }
    
    body {
        background: var(--bg-dark);
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 30px 20px;
        color: var(--text-primary);
        transition: var(--transition);
        background-image: 
            radial-gradient(ellipse at 10% 20%, rgba(108, 99, 255, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 90% 80%, rgba(255, 107, 107, 0.1) 0%, transparent 50%);
    }

    .glass-card {
        background: var(--bg-card);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        padding: 35px;
        width: 100%;
        max-width: 780px;
        box-shadow: var(--shadow);
        transition: var(--transition);
        position: relative;
        overflow: hidden;
    }

    .glass-card::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: radial-gradient(circle at 30% 30%, rgba(108, 99, 255, 0.05), transparent 60%);
        pointer-events: none;
    }

    .header-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 28px;
        position: relative;
        z-index: 1;
    }

    .logo {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .logo-icon {
        width: 44px;
        height: 44px;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
    }

    h1 { 
        font-size: 1.6rem; 
        font-weight: 700; 
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .header-actions {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .theme-toggle, .nav-btn {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        padding: 8px 14px;
        border-radius: 10px;
        cursor: pointer;
        color: var(--text-secondary);
        font-size: 13px;
        transition: var(--transition);
        backdrop-filter: blur(10px);
    }

    .theme-toggle:hover, .nav-btn:hover {
        background: rgba(108, 99, 255, 0.15);
        border-color: var(--primary);
        color: var(--text-primary);
        transform: translateY(-1px);
    }

    .form-group { 
        margin-bottom: 18px;
        position: relative;
        z-index: 1;
    }
    
    label { 
        display: block; 
        margin-bottom: 6px; 
        font-weight: 600; 
        font-size: 13px; 
        color: var(--text-secondary);
        letter-spacing: 0.3px;
    }
    
    input[type="text"], 
    input[type="password"], 
    input[type="number"], 
    input[type="url"],
    textarea, 
    select {
        width: 100%;
        padding: 12px 16px;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-primary);
        font-size: 14px;
        outline: none;
        transition: var(--transition);
    }

    input:focus, textarea:focus, select:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.2);
        background: rgba(255, 255, 255, 0.08);
    }

    input::placeholder, textarea::placeholder {
        color: var(--text-muted);
    }

    textarea { 
        min-height: 80px; 
        resize: vertical;
        line-height: 1.6;
    }

    select option {
        background: #1a1a2e;
        color: white;
    }

    .grid-2 { 
        display: grid; 
        grid-template-columns: 1fr 1fr; 
        gap: 15px; 
    }

    .grid-3 {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 12px;
    }

    .btn-primary {
        width: 100%;
        background: linear-gradient(135deg, var(--primary), var(--primary-dark));
        color: white;
        border: none;
        padding: 14px;
        border-radius: 12px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: var(--transition);
        position: relative;
        overflow: hidden;
    }

    .btn-primary:hover { 
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(108, 99, 255, 0.3);
    }

    .btn-primary:active { transform: translateY(0); }

    .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    .btn-secondary {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        padding: 10px 18px;
        border-radius: 10px;
        cursor: pointer;
        transition: var(--transition);
        font-weight: 500;
        font-size: 13px;
    }

    .btn-secondary:hover {
        background: rgba(108, 99, 255, 0.1);
        border-color: var(--primary);
        color: var(--text-primary);
    }

    .btn-success {
        background: linear-gradient(135deg, var(--success), #40c057);
        color: white;
        border: none;
        padding: 10px 18px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
        transition: var(--transition);
    }

    .btn-success:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(81, 207, 102, 0.3);
    }

    .btn-danger {
        background: linear-gradient(135deg, var(--secondary), #e03131);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: var(--transition);
    }

    .btn-danger:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(255, 107, 107, 0.3);
    }

    .result-box {
        margin-top: 24px;
        padding: 24px;
        background: linear-gradient(135deg, rgba(108, 99, 255, 0.08), rgba(255, 107, 107, 0.05));
        border: 1px solid rgba(108, 99, 255, 0.2);
        border-radius: 16px;
        display: none;
        animation: slideUp 0.4s ease;
        position: relative;
        z-index: 1;
    }

    .result-box.show { display: block; }

    @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .result-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }

    .result-header h3 {
        color: var(--success);
        font-size: 1.1rem;
    }

    .url-display {
        display: flex;
        gap: 10px;
        margin-top: 8px;
    }

    .url-display input {
        flex: 1;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        padding: 10px 14px;
        color: var(--text-primary);
        font-size: 14px;
        font-family: 'Courier New', monospace;
    }

    .url-display input:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.15);
    }

    .action-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .history-section { 
        margin-top: 30px; 
        border-top: 1px solid var(--border-color); 
        padding-top: 20px;
        position: relative;
        z-index: 1;
    }

    .history-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
    }

    .history-header h4 {
        font-size: 0.95rem;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .history-list { 
        list-style: none; 
        max-height: 260px; 
        overflow-y: auto;
        padding-right: 4px;
    }

    .history-list::-webkit-scrollbar {
        width: 4px;
    }

    .history-list::-webkit-scrollbar-track {
        background: var(--border-color);
        border-radius: 10px;
    }

    .history-list::-webkit-scrollbar-thumb {
        background: var(--primary);
        border-radius: 10px;
    }

    .history-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        border-radius: 10px;
        margin-bottom: 4px;
        transition: var(--transition);
        cursor: default;
    }

    .history-item:hover {
        background: rgba(108, 99, 255, 0.06);
    }

    .history-item-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;
    }

    .history-item-code {
        font-weight: 600;
        color: var(--primary);
        font-family: 'Courier New', monospace;
        font-size: 14px;
        white-space: nowrap;
    }

    .history-item-content {
        color: var(--text-secondary);
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .history-item-time {
        color: var(--text-muted);
        font-size: 11px;
        white-space: nowrap;
    }

    .history-item-actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
    }

    .history-item-actions button {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        transition: var(--transition);
        font-size: 13px;
    }

    .history-item-actions button:hover {
        color: var(--text-primary);
        background: rgba(255, 255, 255, 0.05);
    }

    .badge {
        background: rgba(108, 99, 255, 0.15);
        color: var(--primary);
        padding: 2px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
    }

    .badge-success { background: rgba(81, 207, 102, 0.15); color: var(--success); }
    .badge-warning { background: rgba(255, 217, 61, 0.15); color: var(--warning); }
    .badge-danger { background: rgba(255, 107, 107, 0.15); color: var(--secondary); }

    .checkbox-group {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
    }

    .checkbox-group input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: var(--primary);
        cursor: pointer;
        flex-shrink: 0;
    }

    .checkbox-group label {
        margin: 0;
        cursor: pointer;
        font-weight: 400;
        font-size: 14px;
    }

    #toast {
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: var(--bg-card);
        backdrop-filter: blur(20px);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        padding: 14px 28px;
        border-radius: 12px;
        font-weight: 500;
        display: none;
        box-shadow: var(--shadow);
        animation: slideUp 0.3s ease;
        z-index: 999;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
        margin: 16px 0;
    }

    .stat-card {
        background: rgba(108, 99, 255, 0.06);
        padding: 14px;
        border-radius: 12px;
        text-align: center;
        border: 1px solid var(--border-color);
    }

    .stat-card .num {
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--primary);
        line-height: 1.2;
    }

    .stat-card .label {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--border-color);
        font-size: 13px;
    }

    .detail-row .label {
        color: var(--text-secondary);
    }

    .detail-row .value {
        color: var(--text-primary);
        font-weight: 500;
        word-break: break-all;
        text-align: right;
        max-width: 60%;
    }

    @media (max-width: 640px) {
        .glass-card { padding: 20px; }
        .grid-2 { grid-template-columns: 1fr; }
        .grid-3 { grid-template-columns: 1fr 1fr; }
        .header-bar { flex-wrap: wrap; gap: 10px; }
        h1 { font-size: 1.2rem; }
        .url-display { flex-wrap: wrap; }
        .url-display input { min-width: 150px; }
        .history-item { flex-wrap: wrap; gap: 6px; }
        .history-item-info { flex-wrap: wrap; }
        .history-item-actions { margin-left: auto; }
        .stats-grid { grid-template-columns: 1fr 1fr; }
    }

    @media (max-width: 480px) {
        .grid-3 { grid-template-columns: 1fr; }
        .stats-grid { grid-template-columns: 1fr; }
        .header-actions { width: 100%; justify-content: flex-start; }
        .history-item-actions button span { display: none; }
    }
`;

// ------------------------------------------------------------
// 1. 首页 UI
// ------------------------------------------------------------
function handleHomePage() {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>短链接生成器 ULTRA</title>
    <style>${COMMON_STYLE}</style>
</head>
<body>
    <div class="glass-card">
        <div class="header-bar">
            <div class="logo">
                <div class="logo-icon">⚡</div>
                <h1>短链接 ULTRA</h1>
            </div>
            <div class="header-actions">
                <button class="nav-btn" onclick="location.href='/stats'">📊 统计</button>
                <button class="nav-btn" onclick="location.href='/manage'">📋 管理</button>
                <button class="theme-toggle" onclick="toggleTheme()">🌓</button>
            </div>
        </div>

        <form id="linkForm">
            <div class="form-group">
                <label for="content">📎 链接或文本内容 *</label>
                <textarea id="content" placeholder="输入要缩短的 URL (如 https://example.com) 或任意文本..." required></textarea>
            </div>

            <div class="grid-2">
                <div class="form-group">
                    <label for="customCode">🔖 自定义后缀 (可选)</label>
                    <input type="text" id="customCode" placeholder="如: my-link" maxlength="30" pattern="[a-zA-Z0-9_-]+">
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">仅支持字母、数字、下划线、中划线</div>
                </div>
                <div class="form-group">
                    <label for="redirectType">🔄 跳转方式</label>
                    <select id="redirectType">
                        <option value="302">302 临时跳转</option>
                        <option value="301">301 永久跳转</option>
                        <option value="307">307 严格跳转</option>
                    </select>
                </div>
            </div>

            <div class="grid-3">
                <div class="form-group">
                    <label for="delay">⏱️ 延迟跳转 (秒)</label>
                    <input type="number" id="delay" placeholder="0" min="0" max="60" value="0">
                </div>
                <div class="form-group">
                    <label for="ttl">⏳ 有效期 (小时)</label>
                    <input type="number" id="ttl" placeholder="永久" min="1" max="8760">
                </div>
                <div class="form-group">
                    <label for="maxClicks">👆 最大点击次数</label>
                    <input type="number" id="maxClicks" placeholder="不限" min="1" max="999999">
                </div>
            </div>

            <div class="grid-2">
                <div class="form-group">
                    <label for="password">🔒 访问密码 (可选)</label>
                    <input type="password" id="password" placeholder="留空则不设密码">
                </div>
                <div class="form-group" style="display:flex;align-items:flex-end;gap:16px;padding-bottom:4px;">
                    <div class="checkbox-group">
                        <input type="checkbox" id="rawDisplay">
                        <label for="rawDisplay">纯文本展示</label>
                    </div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="showPreview" checked>
                        <label for="showPreview">显示预览</label>
                    </div>
                </div>
            </div>

            <button type="submit" class="btn-primary" id="submitBtn">🚀 生成短链接</button>
        </form>

        <div id="result" class="result-box">
            <div class="result-header">
                <h3>✅ 生成成功！</h3>
                <span class="badge" id="resultType">链接</span>
            </div>
            <div class="url-display">
                <input type="text" id="shortUrl" readonly>
                <div class="action-buttons">
                    <button class="btn-success" onclick="copyToClipboard()">📋 复制</button>
                    <button class="btn-secondary" onclick="openInNewTab()">🔗 打开</button>
                    <button class="btn-secondary" onclick="toggleUrlDisplay()">👁️ 切换</button>
                </div>
            </div>
            <div id="previewArea" style="margin-top:12px;padding:12px;background:rgba(0,0,0,0.1);border-radius:10px;font-size:13px;color:var(--text-secondary);word-break:break-all;display:none;">
                <strong>📄 预览:</strong> <span id="contentPreview"></span>
            </div>
            <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                <span class="badge" id="resultCode">短码: -</span>
                <span class="badge badge-success" id="resultStatus">状态: 正常</span>
                <span class="badge badge-warning" id="resultExpire">过期: 永久</span>
            </div>
        </div>

        <div class="history-section">
            <div class="history-header">
                <h4>📜 生成历史 (最近20条)</h4>
                <div style="display:flex;gap:8px;">
                    <button class="btn-secondary" onclick="exportHistory()" style="padding:4px 12px;font-size:12px;">📤 导出</button>
                    <button class="btn-danger" onclick="clearHistory()">🗑️ 清空</button>
                </div>
            </div>
            <ul id="historyList" class="history-list">
                <li style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0;">暂无历史记录</li>
            </ul>
        </div>

        <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border-color);">
            <div style="display:flex;justify-content:center;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--text-muted);">
                <span>⚡ 极速生成</span>
                <span>🔒 安全加密</span>
                <span>📊 数据分析</span>
                <span>🌐 全球访问</span>
            </div>
        </div>
    </div>

    <div id="toast">已复制！</div>

    <script>
        let currentShortUrl = '';
        let currentContent = '';
        let showOriginal = false;

        document.addEventListener('DOMContentLoaded', () => {
            loadHistory();
            // 检测系统主题
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.setAttribute('data-theme', 'dark');
            }
        });

        function toggleTheme() {
            const current = document.body.getAttribute('data-theme');
            document.body.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
            showToast(current === 'dark' ? '☀️ 浅色模式' : '🌙 深色模式');
        }

        function showToast(msg, duration = 2000) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.style.display = 'block';
            clearTimeout(toast._timer);
            toast._timer = setTimeout(() => { toast.style.display = 'none'; }, duration);
        }

        document.getElementById('linkForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');
            btn.disabled = true;
            btn.textContent = '⏳ 生成中...';

            const payload = {
                content: document.getElementById('content').value.trim(),
                customCode: document.getElementById('customCode').value.trim(),
                redirectType: parseInt(document.getElementById('redirectType').value),
                delay: parseInt(document.getElementById('delay').value) || 0,
                password: document.getElementById('password').value,
                ttl: parseInt(document.getElementById('ttl').value) || null,
                maxClicks: parseInt(document.getElementById('maxClicks').value) || null,
                rawDisplay: document.getElementById('rawDisplay').checked,
                showPreview: document.getElementById('showPreview').checked
            };

            if (!payload.content) {
                alert('请填写内容');
                btn.disabled = false;
                btn.textContent = '🚀 生成短链接';
                return;
            }

            try {
                const res = await fetch('/api/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    currentShortUrl = data.shortUrl;
                    currentContent = payload.content;
                    showOriginal = false;
                    
                    document.getElementById('shortUrl').value = data.shortUrl;
                    document.getElementById('resultCode').textContent = '🔖 短码: ' + data.shortCode;
                    document.getElementById('resultType').textContent = data.isUrl ? '🔗 链接' : '📄 文本';
                    
                    if (payload.ttl) {
                        const expireDate = new Date(Date.now() + payload.ttl * 3600 * 1000);
                        document.getElementById('resultExpire').textContent = '⏳ 过期: ' + expireDate.toLocaleDateString();
                    } else {
                        document.getElementById('resultExpire').textContent = '♾️ 永久有效';
                    }

                    if (payload.showPreview) {
                        document.getElementById('previewArea').style.display = 'block';
                        document.getElementById('contentPreview').textContent = payload.content.length > 200 ? 
                            payload.content.substring(0, 200) + '...' : payload.content;
                    } else {
                        document.getElementById('previewArea').style.display = 'none';
                    }

                    document.getElementById('result').classList.add('show');
                    saveToHistory(data.shortCode, data.shortUrl, payload.content);
                    showToast('🎉 短链接已生成！');
                } else {
                    alert('❌ 生成失败: ' + data.error);
                }
            } catch (err) {
                alert('⚠️ 网络错误: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = '🚀 生成短链接';
            }
        });

        function copyToClipboard() {
            const val = document.getElementById('shortUrl').value;
            navigator.clipboard.writeText(val).then(() => showToast('📋 已复制到剪贴板！'));
        }

        function openInNewTab() {
            const val = document.getElementById('shortUrl').value;
            if (val) window.open(val, '_blank');
        }

        function toggleUrlDisplay() {
            showOriginal = !showOriginal;
            const input = document.getElementById('shortUrl');
            if (showOriginal) {
                input.value = currentContent;
                showToast('👁️ 显示原始内容');
            } else {
                input.value = currentShortUrl;
                showToast('🔗 显示短链接');
            }
        }

        function saveToHistory(code, url, content) {
            let history = JSON.parse(localStorage.getItem('short_history_ultra') || '[]');
            history.unshift({ 
                code, 
                url, 
                content: content.substring(0, 50), 
                time: new Date().toLocaleString(),
                timestamp: Date.now()
            });
            if (history.length > 20) history.pop();
            localStorage.setItem('short_history_ultra', JSON.stringify(history));
            loadHistory();
        }

        function loadHistory() {
            const list = document.getElementById('historyList');
            const history = JSON.parse(localStorage.getItem('short_history_ultra') || '[]');
            if (history.length === 0) {
                list.innerHTML = '<li style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px 0;">暂无历史记录</li>';
                return;
            }
            list.innerHTML = history.map((item, index) => \`
                <li class="history-item">
                    <div class="history-item-info">
                        <span class="history-item-code">/\${item.code}</span>
                        <span class="history-item-content">\${item.content}\${item.content.length > 30 ? '...' : ''}</span>
                        <span class="history-item-time">\${item.time}</span>
                    </div>
                    <div class="history-item-actions">
                        <button onclick="copyHistory('\${item.url}')" title="复制链接">📋</button>
                        <button onclick="openHistory('\${item.url}')" title="打开链接">🔗</button>
                        <button onclick="viewStats('\${item.code}')" title="查看统计">📊</button>
                        <button onclick="removeHistory(\${index})" title="删除">✕</button>
                    </div>
                </li>
            \`).join('');
        }

        function copyHistory(url) {
            navigator.clipboard.writeText(url).then(() => showToast('📋 已复制！'));
        }

        function openHistory(url) {
            window.open(url, '_blank');
        }

        function viewStats(code) {
            window.open('/stats?code=' + code, '_blank');
        }

        function removeHistory(index) {
            let history = JSON.parse(localStorage.getItem('short_history_ultra') || '[]');
            history.splice(index, 1);
            localStorage.setItem('short_history_ultra', JSON.stringify(history));
            loadHistory();
            showToast('🗑️ 已删除');
        }

        function clearHistory() {
            if (confirm('确定要清空所有历史记录吗？')) {
                localStorage.removeItem('short_history_ultra');
                loadHistory();
                showToast('🗑️ 历史已清空');
            }
        }

        function exportHistory() {
            const history = JSON.parse(localStorage.getItem('short_history_ultra') || '[]');
            if (history.length === 0) {
                showToast('⚠️ 暂无历史可导出');
                return;
            }
            const text = history.map(h => \`\${h.time} | /\${h.code} | \${h.url} | \${h.content}\`).join('\\n');
            const blob = new Blob([text], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'short_link_history_' + new Date().toISOString().slice(0,10) + '.txt';
            a.click();
            URL.revokeObjectURL(a.href);
            showToast('📤 导出成功！');
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                document.getElementById('linkForm').dispatchEvent(new Event('submit'));
            }
        });
    </script>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ------------------------------------------------------------
// 2. 统计页面
// ------------------------------------------------------------
function handleStatsPage() {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>数据统计 - Short Link ULTRA</title>
    <style>${COMMON_STYLE}</style>
</head>
<body>
    <div class="glass-card">
        <div class="header-bar">
            <div class="logo">
                <div class="logo-icon">📊</div>
                <h1>数据分析看板</h1>
            </div>
            <div class="header-actions">
                <button class="nav-btn" onclick="location.href='/'">🏠 首页</button>
                <button class="nav-btn" onclick="location.href='/manage'">📋 管理</button>
                <button class="theme-toggle" onclick="toggleTheme()">🌓</button>
            </div>
        </div>

        <div class="form-group">
            <label for="searchCode">🔍 查询短码</label>
            <div style="display:flex;gap:10px;">
                <input type="text" id="searchCode" placeholder="输入短码..." style="flex:1;">
                <button class="btn-primary" onclick="fetchStats()" style="width:auto;padding:12px 24px;">查询</button>
            </div>
        </div>

        <div id="statsResult" class="result-box">
            <div class="stats-grid" id="statsGrid">
                <div class="stat-card">
                    <div class="num" id="totalClicks">0</div>
                    <div class="label">总点击</div>
                </div>
                <div class="stat-card">
                    <div class="num" id="typeDisplay" style="font-size:1.2rem;">-</div>
                    <div class="label">类型</div>
                </div>
                <div class="stat-card">
                    <div class="num" id="statusDisplay" style="font-size:1.2rem;">-</div>
                    <div class="label">状态</div>
                </div>
                <div class="stat-card">
                    <div class="num" id="uniqueVisitors" style="font-size:1.2rem;">0</div>
                    <div class="label">独立访客</div>
                </div>
            </div>

            <div style="margin-top:12px;">
                <div class="detail-row"><span class="label">短码</span><span class="value" id="resCode">-</span></div>
                <div class="detail-row"><span class="label">目标内容</span><span class="value" id="resContent">-</span></div>
                <div class="detail-row"><span class="label">创建时间</span><span class="value" id="resCreated">-</span></div>
                <div class="detail-row"><span class="label">最后访问</span><span class="value" id="resLastAccess">-</span></div>
                <div class="detail-row"><span class="label">过期时间</span><span class="value" id="resExpire">-</span></div>
                <div class="detail-row"><span class="label">跳转方式</span><span class="value" id="resRedirect">-</span></div>
                <div class="detail-row"><span class="label">延迟跳转</span><span class="value" id="resDelay">-</span></div>
                <div class="detail-row"><span class="label">密码保护</span><span class="value" id="resPassword">-</span></div>
                <div class="detail-row"><span class="label">最大点击</span><span class="value" id="resMaxClicks">-</span></div>
                <div class="detail-row"><span class="label">来源 Top 3</span><span class="value" id="resReferrers" style="font-size:12px;">-</span></div>
                <div class="detail-row"><span class="label">地区 Top 3</span><span class="value" id="resCountries" style="font-size:12px;">-</span></div>
                <div class="detail-row"><span class="label">设备 Top 3</span><span class="value" id="resDevices" style="font-size:12px;">-</span></div>
            </div>

            <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
                <button class="btn-secondary" onclick="refreshStats()">🔄 刷新</button>
                <button class="btn-secondary" onclick="exportStats()">📤 导出数据</button>
                <button class="btn-danger" onclick="deleteLink()">🗑️ 删除链接</button>
            </div>
        </div>

        <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border-color);">
            <a href="/" style="color:var(--primary);text-decoration:none;font-size:14px;">← 返回首页</a>
        </div>
    </div>

    <div id="toast">已复制</div>

    <script>
        let currentStatsCode = '';

        function toggleTheme() {
            const current = document.body.getAttribute('data-theme');
            document.body.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
        }

        function showToast(msg) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.style.display = 'block';
            clearTimeout(toast._timer);
            toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 2000);
        }

        document.addEventListener('DOMContentLoaded', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            if (code) {
                document.getElementById('searchCode').value = code;
                fetchStats();
            }
            document.getElementById('searchCode').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') fetchStats();
            });
        });

        async function fetchStats() {
            const code = document.getElementById('searchCode').value.trim();
            if (!code) {
                showToast('⚠️ 请输入短码');
                return;
            }
            currentStatsCode = code;

            try {
                const res = await fetch(\`/api/stats/\${code}\`);
                const data = await res.json();

                if (data.success) {
                    const s = data.stats;
                    document.getElementById('totalClicks').textContent = s.clicks || 0;
                    document.getElementById('typeDisplay').textContent = s.isUrl ? '🔗 链接' : '📄 文本';
                    document.getElementById('statusDisplay').textContent = s.isExpired ? '⛔ 已过期' : '✅ 正常';
                    document.getElementById('statusDisplay').className = 'num ' + (s.isExpired ? 'badge-danger' : 'badge-success');
                    document.getElementById('uniqueVisitors').textContent = s.uniqueVisitors || 0;
                    
                    document.getElementById('resCode').textContent = s.shortCode;
                    document.getElementById('resContent').textContent = s.content || '-';
                    document.getElementById('resCreated').textContent = s.createdAt ? new Date(s.createdAt).toLocaleString() : '-';
                    document.getElementById('resLastAccess').textContent = s.lastAccessedAt ? new Date(s.lastAccessedAt).toLocaleString() : '暂无访问';
                    document.getElementById('resExpire').textContent = s.expiresAt ? new Date(s.expiresAt).toLocaleString() : '♾️ 永久';
                    document.getElementById('resRedirect').textContent = s.redirectType || 302;
                    document.getElementById('resDelay').textContent = s.delay ? s.delay + '秒' : '直接跳转';
                    document.getElementById('resPassword').textContent = s.password ? '🔒 已设置' : '无';
                    document.getElementById('resMaxClicks').textContent = s.maxClicks || '不限';
                    
                    document.getElementById('resReferrers').textContent = formatTop(s.referrers);
                    document.getElementById('resCountries').textContent = formatTop(s.countries);
                    document.getElementById('resDevices').textContent = formatTop(s.devices);

                    document.getElementById('statsResult').classList.add('show');
                } else {
                    showToast('❌ ' + data.error);
                    document.getElementById('statsResult').classList.remove('show');
                }
            } catch (err) {
                showToast('⚠️ 网络错误: ' + err.message);
            }
        }

        function formatTop(obj) {
            if (!obj || Object.keys(obj).length === 0) return '无数据';
            return Object.entries(obj).sort((a,b) => b[1] - a[1]).slice(0,3)
                .map(([k,v]) => \`\${k}: \${v}次\`).join(' | ');
        }

        function refreshStats() {
            if (currentStatsCode) fetchStats();
        }

        function exportStats() {
            if (!currentStatsCode) {
                showToast('⚠️ 请先查询');
                return;
            }
            const rows = document.querySelectorAll('.detail-row');
            let text = '📊 短链接统计报告\\n';
            text += '='.repeat(40) + '\\n';
            text += '短码: ' + document.getElementById('resCode').textContent + '\\n';
            rows.forEach(row => {
                const label = row.querySelector('.label')?.textContent || '';
                const value = row.querySelector('.value')?.textContent || '';
                if (label && value) text += label + ': ' + value + '\\n';
            });
            text += '='.repeat(40) + '\\n';
            text += '导出时间: ' + new Date().toLocaleString();
            
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'stats_' + currentStatsCode + '_' + new Date().toISOString().slice(0,10) + '.txt';
            a.click();
            URL.revokeObjectURL(a.href);
            showToast('📤 导出成功！');
        }

        async function deleteLink() {
            if (!currentStatsCode) {
                showToast('⚠️ 请先查询');
                return;
            }
            if (!confirm('⚠️ 确定要删除短链接 /' + currentStatsCode + ' 吗？此操作不可恢复！')) return;
            
            try {
                const res = await fetch('/api/delete/' + currentStatsCode, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    showToast('🗑️ 已删除');
                    document.getElementById('statsResult').classList.remove('show');
                    document.getElementById('searchCode').value = '';
                } else {
                    showToast('❌ ' + data.error);
                }
            } catch (err) {
                showToast('⚠️ 网络错误');
            }
        }
    </script>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ------------------------------------------------------------
// 3. 管理页面
// ------------------------------------------------------------
function handleManagePage() {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>链接管理 - Short Link ULTRA</title>
    <style>${COMMON_STYLE}</style>
</head>
<body>
    <div class="glass-card">
        <div class="header-bar">
            <div class="logo">
                <div class="logo-icon">📋</div>
                <h1>链接管理中心</h1>
            </div>
            <div class="header-actions">
                <button class="nav-btn" onclick="location.href='/'">🏠 首页</button>
                <button class="nav-btn" onclick="location.href='/stats'">📊 统计</button>
                <button class="theme-toggle" onclick="toggleTheme()">🌓</button>
            </div>
        </div>

        <div style="margin-bottom:20px;">
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <input type="text" id="searchManage" placeholder="🔍 搜索短码或内容..." style="flex:1;min-width:150px;">
                <button class="btn-primary" onclick="searchLinks()" style="width:auto;padding:12px 20px;">搜索</button>
                <button class="btn-secondary" onclick="loadAllLinks()">🔄 刷新</button>
            </div>
        </div>

        <div id="manageList">
            <div style="text-align:center;padding:30px 0;color:var(--text-muted);">
                ⏳ 加载中...
            </div>
        </div>

        <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border-color);">
            <a href="/" style="color:var(--primary);text-decoration:none;font-size:14px;">← 返回首页</a>
        </div>
    </div>

    <div id="toast">操作成功</div>

    <script>
        let allLinks = [];

        function toggleTheme() {
            const current = document.body.getAttribute('data-theme');
            document.body.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
        }

        function showToast(msg) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.style.display = 'block';
            clearTimeout(toast._timer);
            toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 2000);
        }

        document.addEventListener('DOMContentLoaded', loadAllLinks);
        document.getElementById('searchManage').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') searchLinks();
        });

        async function loadAllLinks() {
            const container = document.getElementById('manageList');
            container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">⏳ 加载中...</div>';
            
            try {
                const res = await fetch('/api/list');
                const data = await res.json();
                if (data.success) {
                    allLinks = data.links || [];
                    renderLinks(allLinks);
                } else {
                    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">❌ ' + data.error + '</div>';
                }
            } catch (err) {
                container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">⚠️ 加载失败: ' + err.message + '</div>';
            }
        }

        function renderLinks(links) {
            const container = document.getElementById('manageList');
            if (links.length === 0) {
                container.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--text-muted);">📭 暂无链接</div>';
                return;
            }

            container.innerHTML = links.map(link => \`
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border-color);gap:12px;flex-wrap:wrap;">
                    <div style="flex:1;min-width:120px;">
                        <div style="font-weight:600;color:var(--primary);font-family:monospace;">/\${link.code}</div>
                        <div style="font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;max-width:300px;white-space:nowrap;">\${link.content || '-'}</div>
                        <div style="font-size:11px;color:var(--text-muted);">点击: \${link.clicks || 0} | \${link.createdAt ? new Date(link.createdAt).toLocaleDateString() : '-'}</div>
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <span class="badge \${link.isExpired ? 'badge-danger' : 'badge-success'}">\${link.isExpired ? '已过期' : '正常'}</span>
                        <button class="btn-secondary" onclick="window.open('/\${link.code}','_blank')" style="padding:4px 10px;font-size:12px;">🔗 访问</button>
                        <button class="btn-secondary" onclick="window.open('/stats?code=\${link.code}','_blank')" style="padding:4px 10px;font-size:12px;">📊</button>
                        <button class="btn-danger" onclick="deleteLink('\${link.code}')" style="padding:4px 10px;font-size:12px;">🗑️</button>
                    </div>
                </div>
            \`).join('');
        }

        function searchLinks() {
            const query = document.getElementById('searchManage').value.trim().toLowerCase();
            if (!query) {
                renderLinks(allLinks);
                return;
            }
            const filtered = allLinks.filter(link => 
                link.code.toLowerCase().includes(query) || 
                (link.content && link.content.toLowerCase().includes(query))
            );
            renderLinks(filtered);
            showToast('🔍 找到 ' + filtered.length + ' 条结果');
        }

        async function deleteLink(code) {
            if (!confirm('确定删除 /' + code + ' 吗？')) return;
            try {
                const res = await fetch('/api/delete/' + code, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    showToast('🗑️ 已删除');
                    loadAllLinks();
                } else {
                    showToast('❌ ' + data.error);
                }
            } catch (err) {
                showToast('⚠️ 网络错误');
            }
        }
    </script>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ------------------------------------------------------------
// 4. API 处理
// ------------------------------------------------------------
async function handleAPI(request, env, path) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    // 创建短链接
    if (path === '/api/create' && request.method === 'POST') {
        try {
            const body = await request.json();
            const { content, customCode, redirectType, delay, password, ttl, maxClicks, rawDisplay } = body;

            if (!content || content.trim().length === 0) {
                return new Response(JSON.stringify({ success: false, error: '内容不能为空' }), { status: 400, headers: corsHeaders });
            }

            let shortCode = customCode?.trim();
            const urlCheck = formatUrl(content);

            if (shortCode) {
                if (!/^[a-zA-Z0-9_-]+$/.test(shortCode)) {
                    return new Response(JSON.stringify({ success: false, error: '自定义后缀仅支持字母、数字、下划线及中划线' }), { status: 400, headers: corsHeaders });
                }
                if (RESERVED_PATHS.includes(shortCode.toLowerCase())) {
                    return new Response(JSON.stringify({ success: false, error: '该后缀为系统保留字' }), { status: 400, headers: corsHeaders });
                }
                const existing = await env.LINKS_KV.get(shortCode);
                if (existing) {
                    return new Response(JSON.stringify({ success: false, error: '该自定义后缀已被占用' }), { status: 400, headers: corsHeaders });
                }
            } else {
                shortCode = generateShortCode();
                let attempts = 0;
                while (await env.LINKS_KV.get(shortCode) && attempts < 10) {
                    shortCode = generateShortCode();
                    attempts++;
                }
            }

            let expiresAt = null;
            let kvOptions = {};
            if (ttl && ttl > 0) {
                const ttlSeconds = ttl * 3600;
                kvOptions.expirationTtl = ttlSeconds;
                expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
            }

            const linkData = {
                content: urlCheck.isValid ? urlCheck.url : content.trim(),
                isUrl: urlCheck.isValid,
                redirectType: redirectType || 302,
                delay: delay || 0,
                password: password ? password.trim() : null,
                maxClicks: maxClicks || null,
                rawDisplay: rawDisplay || false,
                createdAt: new Date().toISOString(),
                expiresAt: expiresAt,
                clicks: 0,
                lastAccessedAt: null,
                referrers: {},
                countries: {},
                devices: {},
                visitors: [],
                uniqueVisitors: 0
            };

            await env.LINKS_KV.put(shortCode, JSON.stringify(linkData), kvOptions);

            const shortUrl = `${new URL(request.url).origin}/${shortCode}`;

            return new Response(JSON.stringify({
                success: true,
                shortUrl: shortUrl,
                shortCode: shortCode,
                isUrl: linkData.isUrl
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } catch (err) {
            return new Response(JSON.stringify({ success: false, error: '服务器错误: ' + err.message }), { status: 500, headers: corsHeaders });
        }
    }

    // 获取统计数据
    if (path.startsWith('/api/stats/') && request.method === 'GET') {
        const code = path.substring('/api/stats/'.length);
        const linkDataStr = await env.LINKS_KV.get(code);

        if (!linkDataStr) {
            return new Response(JSON.stringify({ success: false, error: '短链接不存在或已过期' }), { status: 404, headers: corsHeaders });
        }

        const data = JSON.parse(linkDataStr);
        const now = Date.now();
        const isExpired = data.expiresAt ? new Date(data.expiresAt).getTime() < now : false;
        const isMaxClicksReached = data.maxClicks ? data.clicks >= data.maxClicks : false;

        return new Response(JSON.stringify({
            success: true,
            stats: {
                shortCode: code,
                content: data.content,
                isUrl: data.isUrl,
                clicks: data.clicks || 0,
                uniqueVisitors: data.uniqueVisitors || 0,
                createdAt: data.createdAt,
                lastAccessedAt: data.lastAccessedAt,
                expiresAt: data.expiresAt,
                isExpired: isExpired || isMaxClicksReached,
                redirectType: data.redirectType,
                delay: data.delay,
                password: !!data.password,
                maxClicks: data.maxClicks,
                referrers: data.referrers || {},
                countries: data.countries || {},
                devices: data.devices || {}
            }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 列出所有链接
    if (path === '/api/list' && request.method === 'GET') {
        try {
            const list = await env.LINKS_KV.list({ limit: 100 });
            const links = [];
            for (const key of list.keys) {
                const data = await env.LINKS_KV.get(key.name);
                if (data) {
                    const parsed = JSON.parse(data);
                    const now = Date.now();
                    const isExpired = parsed.expiresAt ? new Date(parsed.expiresAt).getTime() < now : false;
                    links.push({
                        code: key.name,
                        content: parsed.content,
                        clicks: parsed.clicks || 0,
                        createdAt: parsed.createdAt,
                        isExpired: isExpired
                    });
                }
            }
            links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return new Response(JSON.stringify({ success: true, links }), { headers: corsHeaders });
        } catch (err) {
            return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
        }
    }

    // 删除链接
    if (path.startsWith('/api/delete/') && request.method === 'DELETE') {
        const code = path.substring('/api/delete/'.length);
        const exists = await env.LINKS_KV.get(code);
        if (!exists) {
            return new Response(JSON.stringify({ success: false, error: '链接不存在' }), { status: 404, headers: corsHeaders });
        }
        await env.LINKS_KV.delete(code);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    return new Response('API Not Found', { status: 404, headers: corsHeaders });
}

// ------------------------------------------------------------
// 5. 处理短链接访问
// ------------------------------------------------------------
async function handleShortLink(request, env, ctx, shortCode) {
    const linkDataStr = await env.LINKS_KV.get(shortCode);

    if (!linkDataStr) {
        return new Response(`<!DOCTYPE html>
<html><head><title>404</title><style>body{background:#0a0a1a;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;text-align:center;}</style></head>
<body><div><h1>🔗 链接不存在</h1><p style="color:rgba(255,255,255,0.6);">该短链接可能已被删除或已过期</p><a href="/" style="color:#6C63FF;text-decoration:none;">← 返回首页</a></div></body></html>`, 
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const linkData = JSON.parse(linkDataStr);
    const url = new URL(request.url);

    // 检查过期
    if (linkData.expiresAt && new Date(linkData.expiresAt).getTime() < Date.now()) {
        return new Response(`<!DOCTYPE html>
<html><head><title>已过期</title><style>body{background:#0a0a1a;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;text-align:center;}</style></head>
<body><div><h1>⏳ 链接已过期</h1><p style="color:rgba(255,255,255,0.6);">该短链接已超过有效期限</p><a href="/" style="color:#6C63FF;text-decoration:none;">← 返回首页</a></div></body></html>`,
        { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // 检查最大点击
    if (linkData.maxClicks && linkData.clicks >= linkData.maxClicks) {
        return new Response(`<!DOCTYPE html>
<html><head><title>已失效</title><style>body{background:#0a0a1a;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;text-align:center;}</style></head>
<body><div><h1>📊 链接已失效</h1><p style="color:rgba(255,255,255,0.6);">该短链接已达到最大访问次数</p><a href="/" style="color:#6C63FF;text-decoration:none;">← 返回首页</a></div></body></html>`,
        { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // 密码验证
    if (linkData.password) {
        const reqPassword = url.searchParams.get('pwd') || 
                           (request.method === 'POST' ? (await request.formData()).get('pwd') : null);
        if (reqPassword !== linkData.password) {
            return handlePasswordPage(shortCode);
        }
    }

    // 异步更新统计
    ctx.waitUntil((async () => {
        const clientIP = getClientIP(request);
        
        linkData.clicks = (linkData.clicks || 0) + 1;
        linkData.lastAccessedAt = new Date().toISOString();

        // 独立访客统计
        if (!linkData.visitors) linkData.visitors = [];
        if (!linkData.visitors.includes(clientIP)) {
            linkData.visitors.push(clientIP);
            linkData.uniqueVisitors = linkData.visitors.length;
        }

        // Referer 统计
        const ref = request.headers.get('referer');
        if (ref) {
            try {
                const host = new URL(ref).hostname;
                linkData.referrers[host] = (linkData.referrers[host] || 0) + 1;
            } catch (_) {}
        }

        // 地区统计
        const country = request.cf?.country || '其他';
        linkData.countries[country] = (linkData.countries[country] || 0) + 1;

        // 设备统计
        const userAgent = request.headers.get('user-agent') || '';
        let device = '其他';
        if (/mobile/i.test(userAgent)) device = '移动端';
        else if (/tablet/i.test(userAgent)) device = '平板';
        else if (/bot|crawler|spider/i.test(userAgent)) device = '爬虫';
        else device = '桌面端';
        linkData.devices[device] = (linkData.devices[device] || 0) + 1;

        await env.LINKS_KV.put(shortCode, JSON.stringify(linkData));
    })());

    // 跳转逻辑
    if (linkData.isUrl && !linkData.rawDisplay) {
        if (linkData.delay > 0) {
            return handleDelayRedirectPage(linkData.content, linkData.delay);
        }
        return Response.redirect(linkData.content, linkData.redirectType || 302);
    }

    // 文本展示
    if (linkData.rawDisplay) {
        return new Response(linkData.content, { 
            headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
        });
    } else {
        return handleTextContentPage(linkData.content, shortCode, linkData.clicks + 1);
    }
}

// 密码输入页面
function handlePasswordPage(shortCode) {
    return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>密码保护</title>
<style>${COMMON_STYLE}</style></head>
<body>
<div class="glass-card" style="max-width:420px;text-align:center;">
    <div style="font-size:48px;margin-bottom:12px;">🔒</div>
    <h2 style="margin-bottom:4px;">访问受密码保护</h2>
    <p style="color:var(--text-secondary);font-size:14px;margin-bottom:20px;">请输入访问密码以继续</p>
    <form method="POST" style="display:flex;flex-direction:column;gap:12px;">
        <input type="password" name="pwd" placeholder="请输入密码" required autofocus style="text-align:center;font-size:16px;">
        <button type="submit" class="btn-primary">🔓 解锁访问</button>
    </form>
    <div style="margin-top:16px;font-size:12px;color:var(--text-muted);">短码: /${shortCode}</div>
</div>
</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// 延迟跳转页面
function handleDelayRedirectPage(targetUrl, delaySeconds) {
    return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>跳转中...</title>
<style>${COMMON_STYLE}</style></head>
<body>
<div class="glass-card" style="max-width:480px;text-align:center;">
    <div style="font-size:48px;margin-bottom:8px;">🚀</div>
    <h2 style="margin-bottom:4px;">即将跳转</h2>
    <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px;">页面将在 <strong id="countdown" style="color:var(--primary);font-size:24px;">${delaySeconds}</strong> 秒后跳转</p>
    <div style="background:rgba(108,99,255,0.08);padding:12px;border-radius:10px;font-size:13px;color:var(--text-secondary);word-break:break-all;margin-bottom:16px;">
        📎 ${targetUrl}
    </div>
    <a href="${targetUrl}" class="btn-primary" style="display:inline-block;text-decoration:none;width:auto;padding:12px 28px;">立即跳转 →</a>
</div>
<script>
    let left = ${delaySeconds};
    const timer = setInterval(() => {
        left--;
        document.getElementById('countdown').textContent = left;
        if (left <= 0) { clearInterval(timer); window.location.href = "${targetUrl}"; }
    }, 1000);
</script>
</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// 文本展示页面
function handleTextContentPage(content, shortCode, clicks) {
    return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>文本内容</title>
<style>${COMMON_STYLE}</style></head>
<body>
<div class="glass-card">
    <div class="header-bar">
        <div class="logo">
            <div class="logo-icon">📄</div>
            <h1 style="-webkit-text-fill-color:var(--text-primary);background:none;">文本内容查看</h1>
        </div>
        <span class="badge">/${shortCode}</span>
    </div>
    <div style="background:rgba(0,0,0,0.08);padding:20px;border-radius:12px;white-space:pre-wrap;word-break:break-all;margin:12px 0;max-height:400px;overflow-y:auto;font-size:14px;line-height:1.8;border:1px solid var(--border-color);">
        ${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px;">
        <span style="color:var(--text-muted);font-size:13px;">👁️ 浏览次数: ${clicks}</span>
        <div style="display:flex;gap:8px;">
            <button class="btn-secondary" onclick="navigator.clipboard.writeText('${content.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}').then(()=>alert('已复制'))" style="padding:6px 14px;font-size:12px;">📋 复制内容</button>
            <a href="/" class="btn-primary" style="display:inline-block;width:auto;padding:8px 18px;text-decoration:none;font-size:13px;">⚡ 创建短链接</a>
        </div>
    </div>
</div>
</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
