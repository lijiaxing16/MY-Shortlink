// ============================================================
//  Short Link Generator ULTRA Edition v2.0 (Cloudflare Worker)
//  新增: 链接伪装、设备跳转、地理跳转、A/B测试、智能路由
// ============================================================

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (path === '/') {
            return handleHomePage();
        }

        if (path === '/stats' || path.startsWith('/stats/')) {
            return handleStatsPage();
        }

        if (path === '/manage') {
            return handleManagePage();
        }

        if (path.startsWith('/api/')) {
            return handleAPI(request, env, path);
        }

        if (path.length > 1) {
            return handleShortLink(request, env, ctx, path.substring(1));
        }

        return new Response('404 Not Found', { status: 404 });
    }
};

const RESERVED_PATHS = ['api', 'stats', 'manage', 'favicon.ico', 'robots.txt', 'admin'];

function generateShortCode(length = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

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

function getClientIP(request) {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For')?.split(',')[0] || 
           request.headers.get('X-Real-IP') || 
           'unknown';
}

function getDeviceType(userAgent) {
    const ua = userAgent.toLowerCase();
    if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) return 'mobile';
    if (/tablet|ipad|kindle|silk/i.test(ua)) return 'tablet';
    if (/bot|crawler|spider|scraper|facebook|whatsapp|telegram/i.test(ua)) return 'bot';
    return 'desktop';
}

function getCountry(request) {
    return request.cf?.country || request.headers.get('CF-IPCountry') || 'US';
}

// ------------------------------------------------------------
// 🎨 公共样式 - 霓虹玻璃风格 (增强)
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
        max-width: 860px;
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
        flex-wrap: wrap;
        gap: 10px;
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
        flex-shrink: 0;
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
        flex-wrap: wrap;
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

    .grid-4 {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 10px;
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
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

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

    .btn-outline {
        background: transparent;
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        padding: 8px 14px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        transition: var(--transition);
    }

    .btn-outline:hover {
        border-color: var(--primary);
        color: var(--text-primary);
        background: rgba(108, 99, 255, 0.05);
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
        flex-wrap: wrap;
        gap: 8px;
    }

    .result-header h3 {
        color: var(--success);
        font-size: 1.1rem;
    }

    .url-display {
        display: flex;
        gap: 10px;
        margin-top: 8px;
        flex-wrap: wrap;
    }

    .url-display input {
        flex: 1;
        min-width: 150px;
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
        flex-wrap: wrap;
        gap: 8px;
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
        flex-wrap: wrap;
        gap: 6px;
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
        flex-wrap: wrap;
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
        max-width: 200px;
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
    .badge-info { background: rgba(77, 171, 247, 0.15); color: var(--info); }

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

    .rule-group {
        background: rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        border: 1px solid var(--border-color);
    }

    .rule-group .rule-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        flex-wrap: wrap;
        gap: 6px;
    }

    .rule-group .rule-header h5 {
        color: var(--text-secondary);
        font-size: 13px;
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
        gap: 12px;
    }

    .detail-row .label {
        color: var(--text-secondary);
        flex-shrink: 0;
    }

    .detail-row .value {
        color: var(--text-primary);
        font-weight: 500;
        word-break: break-all;
        text-align: right;
    }

    .tab-bar {
        display: flex;
        gap: 4px;
        background: rgba(0, 0, 0, 0.15);
        border-radius: 12px;
        padding: 4px;
        margin-bottom: 16px;
        flex-wrap: wrap;
        border: 1px solid var(--border-color);
    }

    .tab-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        font-weight: 500;
        font-size: 13px;
        transition: var(--transition);
        flex: 1;
        min-width: 60px;
    }

    .tab-btn:hover {
        color: var(--text-primary);
        background: rgba(255, 255, 255, 0.05);
    }

    .tab-btn.active {
        background: var(--primary);
        color: white;
        box-shadow: 0 4px 12px rgba(108, 99, 255, 0.3);
    }

    .tab-content {
        display: none;
        animation: slideUp 0.3s ease;
    }

    .tab-content.active {
        display: block;
    }

    @media (max-width: 640px) {
        .glass-card { padding: 20px; }
        .grid-2 { grid-template-columns: 1fr; }
        .grid-3 { grid-template-columns: 1fr 1fr; }
        .grid-4 { grid-template-columns: 1fr 1fr; }
        .header-bar { flex-direction: column; align-items: stretch; }
        .header-actions { justify-content: flex-start; }
        h1 { font-size: 1.2rem; }
        .url-display { flex-direction: column; }
        .url-display input { min-width: 100%; }
        .action-buttons { width: 100%; justify-content: flex-start; }
        .history-item { flex-direction: column; align-items: stretch; }
        .history-item-info { flex-wrap: wrap; }
        .history-item-content { max-width: 100%; }
        .history-item-actions { justify-content: flex-start; margin-top: 4px; }
        .stats-grid { grid-template-columns: 1fr 1fr; }
        .tab-btn { font-size: 11px; padding: 6px 10px; }
    }

    @media (max-width: 480px) {
        .grid-3 { grid-template-columns: 1fr; }
        .grid-4 { grid-template-columns: 1fr; }
        .stats-grid { grid-template-columns: 1fr; }
    }
`;

// ------------------------------------------------------------
// 1. 首页 UI (增强版)
// ------------------------------------------------------------
function handleHomePage() {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>短链接生成器 ULTRA v2.0</title>
    <style>${COMMON_STYLE}</style>
</head>
<body>
    <div class="glass-card">
        <div class="header-bar">
            <div class="logo">
                <div class="logo-icon">⚡</div>
                <h1>短链接 ULTRA v2.0</h1>
            </div>
            <div class="header-actions">
                <button class="nav-btn" onclick="location.href='/stats'">📊 统计</button>
                <button class="nav-btn" onclick="location.href='/manage'">📋 管理</button>
                <button class="theme-toggle" onclick="toggleTheme()">🌓</button>
            </div>
        </div>

        <!-- Tab 切换 -->
        <div class="tab-bar">
            <button class="tab-btn active" data-tab="basic" onclick="switchTab('basic')">📝 基础</button>
            <button class="tab-btn" data-tab="smart" onclick="switchTab('smart')">🧠 智能路由</button>
            <button class="tab-btn" data-tab="mask" onclick="switchTab('mask')">🎭 链接伪装</button>
            <button class="tab-btn" data-tab="advanced" onclick="switchTab('advanced')">⚙️ 高级</button>
        </div>

        <form id="linkForm">
            <!-- ===== 基础 Tab ===== -->
            <div id="tab-basic" class="tab-content active">
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
                    <div class="form-group" style="display:flex;align-items:flex-end;gap:16px;padding-bottom:4px;flex-wrap:wrap;">
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
            </div>

            <!-- ===== 智能路由 Tab ===== -->
            <div id="tab-smart" class="tab-content">
                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">根据访客设备、地理位置等条件智能跳转到不同目标</p>
                
                <div class="form-group">
                    <label>📱 设备跳转规则</label>
                    <div class="rule-group">
                        <div class="rule-header">
                            <h5>📱 移动端</h5>
                            <button type="button" class="btn-outline" onclick="clearRule('mobile')">清除</button>
                        </div>
                        <input type="text" id="ruleMobile" placeholder="移动端跳转目标 URL" style="font-size:13px;">
                    </div>
                    <div class="rule-group">
                        <div class="rule-header">
                            <h5>💻 桌面端</h5>
                            <button type="button" class="btn-outline" onclick="clearRule('desktop')">清除</button>
                        </div>
                        <input type="text" id="ruleDesktop" placeholder="桌面端跳转目标 URL" style="font-size:13px;">
                    </div>
                    <div class="rule-group">
                        <div class="rule-header">
                            <h5>📟 平板</h5>
                            <button type="button" class="btn-outline" onclick="clearRule('tablet')">清除</button>
                        </div>
                        <input type="text" id="ruleTablet" placeholder="平板端跳转目标 URL" style="font-size:13px;">
                    </div>
                </div>

                <div class="form-group">
                    <label>🌍 地理跳转规则</label>
                    <div id="geoRulesContainer">
                        <div class="rule-group" id="geoRuleTemplate">
                            <div class="rule-header">
                                <h5>📍 国家/地区</h5>
                                <button type="button" class="btn-danger" onclick="removeGeoRule(this)" style="padding:2px 8px;font-size:11px;">✕</button>
                            </div>
                            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                                <input type="text" class="geoCountry" placeholder="国家代码 (如 US, CN, GB)" style="flex:1;min-width:80px;font-size:13px;">
                                <input type="text" class="geoUrl" placeholder="跳转目标 URL" style="flex:2;min-width:120px;font-size:13px;">
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn-secondary" onclick="addGeoRule()" style="width:auto;padding:8px 16px;font-size:12px;margin-top:8px;">➕ 添加国家规则</button>
                </div>

                <div class="form-group">
                    <label>🎯 A/B 测试 (随机分流)</label>
                    <div id="abRulesContainer">
                        <div class="rule-group" id="abRuleTemplate">
                            <div class="rule-header">
                                <h5>分流规则</h5>
                                <button type="button" class="btn-danger" onclick="removeAbRule(this)" style="padding:2px 8px;font-size:11px;">✕</button>
                            </div>
                            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                                <input type="number" class="abWeight" placeholder="权重 (如 50)" min="1" max="100" style="flex:1;min-width:60px;font-size:13px;">
                                <input type="text" class="abUrl" placeholder="跳转目标 URL" style="flex:2;min-width:120px;font-size:13px;">
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn-secondary" onclick="addAbRule()" style="width:auto;padding:8px 16px;font-size:12px;margin-top:8px;">➕ 添加分流规则</button>
                </div>
            </div>

            <!-- ===== 链接伪装 Tab ===== -->
            <div id="tab-mask" class="tab-content">
                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">伪装短链接，使其看起来像是其他知名网站的链接</p>
                
                <div class="form-group">
                    <label>🎭 伪装域名</label>
                    <select id="maskDomain" onchange="updateMaskPreview()">
                        <option value="">不使用伪装</option>
                        <option value="google.com">google.com</option>
                        <option value="youtube.com">youtube.com</option>
                        <option value="facebook.com">facebook.com</option>
                        <option value="twitter.com">twitter.com</option>
                        <option value="instagram.com">instagram.com</option>
                        <option value="github.com">github.com</option>
                        <option value="stackoverflow.com">stackoverflow.com</option>
                        <option value="wikipedia.org">wikipedia.org</option>
                        <option value="amazon.com">amazon.com</option>
                        <option value="apple.com">apple.com</option>
                        <option value="microsoft.com">microsoft.com</option>
                        <option value="custom">自定义</option>
                    </select>
                </div>

                <div class="form-group" id="customMaskGroup" style="display:none;">
                    <label>自定义伪装域名</label>
                    <input type="text" id="customMaskDomain" placeholder="如: example.com" oninput="updateMaskPreview()">
                </div>

                <div class="form-group">
                    <label>🔗 伪装路径</label>
                    <input type="text" id="maskPath" placeholder="如: /search?q=hello" value="/" oninput="updateMaskPreview()">
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">访问者看到的链接路径 (建议包含 / )</div>
                </div>

                <div class="form-group">
                    <label>📋 伪装预览</label>
                    <div style="background:rgba(0,0,0,0.1);padding:12px;border-radius:10px;font-family:monospace;font-size:14px;color:var(--text-secondary);word-break:break-all;" id="maskPreview">
                        选择伪装域名后预览
                    </div>
                </div>

                <div class="checkbox-group">
                    <input type="checkbox" id="maskEnabled">
                    <label for="maskEnabled">✅ 启用链接伪装</label>
                </div>
            </div>

            <!-- ===== 高级 Tab ===== -->
            <div id="tab-advanced" class="tab-content">
                <div class="form-group">
                    <label>📊 是否记录详细分析数据</label>
                    <div class="checkbox-group">
                        <input type="checkbox" id="trackAnalytics" checked>
                        <label for="trackAnalytics">记录访问来源、设备、地理位置等</label>
                    </div>
                </div>

                <div class="form-group">
                    <label>🛡️ 安全设置</label>
                    <div class="checkbox-group">
                        <input type="checkbox" id="noReferrer">
                        <label for="noReferrer">禁止传递 Referrer (隐私保护)</label>
                    </div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="noFollow">
                        <label for="noFollow">添加 rel="nofollow" (SEO)</label>
                    </div>
                </div>

                <div class="form-group">
                    <label>📝 备注 (仅自己可见)</label>
                    <input type="text" id="note" placeholder="添加备注信息...">
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
                </div>
            </div>
            <div id="previewArea" style="margin-top:12px;padding:12px;background:rgba(0,0,0,0.1);border-radius:10px;font-size:13px;color:var(--text-secondary);word-break:break-all;display:none;">
                <strong>📄 预览:</strong> <span id="contentPreview"></span>
            </div>
            <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                <span class="badge" id="resultCode">短码: -</span>
                <span class="badge badge-success" id="resultStatus">状态: 正常</span>
                <span class="badge badge-warning" id="resultExpire">过期: 永久</span>
                <span class="badge badge-info" id="resultMask" style="display:none;">🎭 伪装中</span>
            </div>
        </div>

        <div class="history-section">
            <div class="history-header">
                <h4>📜 生成历史 (最近20条)</h4>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
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
                <span>🧠 智能路由</span>
                <span>🎭 链接伪装</span>
            </div>
        </div>
    </div>

    <div id="toast">已复制！</div>

    <script>
        let currentShortUrl = '';
        let currentOriginalContent = '';
        let currentIsUrl = true;

        // ===== Tab 切换 =====
        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            document.getElementById('tab-' + tabId).classList.add('active');
            document.querySelector(\`.tab-btn[data-tab="\${tabId}"]\`).classList.add('active');
        }

        // ===== 智能路由 - 地理规则 =====
        function addGeoRule() {
            const container = document.getElementById('geoRulesContainer');
            const template = document.getElementById('geoRuleTemplate');
            const clone = template.cloneNode(true);
            clone.id = 'geoRule_' + Date.now();
            clone.querySelector('.geoCountry').value = '';
            clone.querySelector('.geoUrl').value = '';
            clone.style.display = 'block';
            container.appendChild(clone);
        }

        function removeGeoRule(btn) {
            const rule = btn.closest('.rule-group');
            if (document.querySelectorAll('.rule-group').length > 1) {
                rule.remove();
            } else {
                alert('至少保留一条规则');
            }
        }

        // ===== 智能路由 - A/B测试 =====
        function addAbRule() {
            const container = document.getElementById('abRulesContainer');
            const template = document.getElementById('abRuleTemplate');
            const clone = template.cloneNode(true);
            clone.id = 'abRule_' + Date.now();
            clone.querySelector('.abWeight').value = '';
            clone.querySelector('.abUrl').value = '';
            clone.style.display = 'block';
            container.appendChild(clone);
        }

        function removeAbRule(btn) {
            const rule = btn.closest('.rule-group');
            if (document.querySelectorAll('.rule-group').length > 1) {
                rule.remove();
            } else {
                alert('至少保留一条规则');
            }
        }

        // ===== 清除规则 =====
        function clearRule(type) {
            document.getElementById('rule' + type.charAt(0).toUpperCase() + type.slice(1)).value = '';
        }

        // ===== 链接伪装 =====
        function updateMaskPreview() {
            const domain = document.getElementById('maskDomain').value;
            const customDomain = document.getElementById('customMaskDomain').value;
            const path = document.getElementById('maskPath').value || '/';
            const preview = document.getElementById('maskPreview');
            
            let displayDomain = domain;
            if (domain === 'custom') {
                displayDomain = customDomain || 'example.com';
            }
            if (!displayDomain || displayDomain === '') {
                preview.textContent = '请选择伪装域名';
                return;
            }
            preview.textContent = 'https://' + displayDomain + path;
        }

        document.getElementById('maskDomain').addEventListener('change', function() {
            document.getElementById('customMaskGroup').style.display = this.value === 'custom' ? 'block' : 'none';
            updateMaskPreview();
        });

        // ===== 表单提交 =====
        document.getElementById('linkForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');
            btn.disabled = true;
            btn.textContent = '⏳ 生成中...';

            // 收集基础数据
            const content = document.getElementById('content').value.trim();
            
            // 收集智能路由规则
            const mobileRule = document.getElementById('ruleMobile').value.trim();
            const desktopRule = document.getElementById('ruleDesktop').value.trim();
            const tabletRule = document.getElementById('ruleTablet').value.trim();
            
            const geoRules = [];
            document.querySelectorAll('#geoRulesContainer .rule-group').forEach(el => {
                const country = el.querySelector('.geoCountry').value.trim().toUpperCase();
                const url = el.querySelector('.geoUrl').value.trim();
                if (country && url) geoRules.push({ country, url });
            });

            const abRules = [];
            document.querySelectorAll('#abRulesContainer .rule-group').forEach(el => {
                const weight = parseInt(el.querySelector('.abWeight').value) || 0;
                const url = el.querySelector('.abUrl').value.trim();
                if (weight > 0 && url) abRules.push({ weight, url });
            });

            // 收集伪装数据
            const maskEnabled = document.getElementById('maskEnabled').checked;
            let maskDomain = document.getElementById('maskDomain').value;
            if (maskDomain === 'custom') {
                maskDomain = document.getElementById('customMaskDomain').value.trim();
            }
            const maskPath = document.getElementById('maskPath').value.trim();

            const payload = {
                content: content,
                customCode: document.getElementById('customCode').value.trim(),
                redirectType: parseInt(document.getElementById('redirectType').value),
                delay: parseInt(document.getElementById('delay').value) || 0,
                password: document.getElementById('password').value,
                ttl: parseInt(document.getElementById('ttl').value) || null,
                maxClicks: parseInt(document.getElementById('maxClicks').value) || null,
                rawDisplay: document.getElementById('rawDisplay').checked,
                showPreview: document.getElementById('showPreview').checked,
                
                // 智能路由
                smartRules: {
                    mobile: mobileRule || null,
                    desktop: desktopRule || null,
                    tablet: tabletRule || null,
                    geo: geoRules.length > 0 ? geoRules : null,
                    ab: abRules.length > 0 ? abRules : null
                },
                
                // 伪装
                mask: maskEnabled ? {
                    domain: maskDomain,
                    path: maskPath || '/'
                } : null,
                
                // 高级
                trackAnalytics: document.getElementById('trackAnalytics').checked,
                noReferrer: document.getElementById('noReferrer').checked,
                noFollow: document.getElementById('noFollow').checked,
                note: document.getElementById('note').value.trim() || null
            };

            if (!content) {
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
                    currentOriginalContent = content;
                    currentIsUrl = data.isUrl;
                    
                    document.getElementById('shortUrl').value = data.shortUrl;
                    document.getElementById('resultCode').textContent = '🔖 短码: ' + data.shortCode;
                    document.getElementById('resultType').textContent = data.isUrl ? '🔗 链接' : '📄 文本';
                    
                    if (payload.ttl) {
                        const expireDate = new Date(Date.now() + payload.ttl * 3600 * 1000);
                        document.getElementById('resultExpire').textContent = '⏳ 过期: ' + expireDate.toLocaleDateString();
                    } else {
                        document.getElementById('resultExpire').textContent = '♾️ 永久有效';
                    }

                    // 伪装标记
                    const maskBadge = document.getElementById('resultMask');
                    if (payload.mask && payload.mask.domain) {
                        maskBadge.style.display = 'inline-block';
                    } else {
                        maskBadge.style.display = 'none';
                    }

                    // 预览
                    const previewArea = document.getElementById('previewArea');
                    if (payload.showPreview) {
                        previewArea.style.display = 'block';
                        document.getElementById('contentPreview').textContent = content.length > 200 ? 
                            content.substring(0, 200) + '...' : content;
                    } else {
                        previewArea.style.display = 'none';
                    }

                    document.getElementById('result').classList.add('show');
                    saveToHistory(data.shortCode, data.shortUrl, content);
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

        // ===== 工具函数 =====
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

        function copyToClipboard() {
            const val = document.getElementById('shortUrl').value;
            navigator.clipboard.writeText(val).then(() => showToast('📋 已复制到剪贴板！'));
        }

        function openInNewTab() {
            const val = document.getElementById('shortUrl').value;
            if (val) window.open(val, '_blank');
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

        // ===== 初始化 =====
        document.addEventListener('DOMContentLoaded', () => {
            loadHistory();
            updateMaskPreview();
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.setAttribute('data-theme', 'dark');
            }
        });

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
// 2. 统计页面 (与之前相同)
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
                <div class="detail-row"><span class="label">伪装</span><span class="value" id="resMask">-</span></div>
                <div class="detail-row"><span class="label">智能路由</span><span class="value" id="resSmart" style="font-size:12px;">-</span></div>
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
                    document.getElementById('resMask').textContent = s.mask ? \`🎭 \${s.mask.domain}\${s.mask.path}\` : '未启用';
                    document.getElementById('resSmart').textContent = s.smartRules ? '✅ 已配置' : '未配置';
                    
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
// 3. 管理页面 (与之前相同)
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
            <div style="text-align:center;padding:30px 0;color:var(--text-muted);">⏳ 加载中...</div>
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
                        \${link.mask ? '<span class="badge badge-info">🎭 伪装</span>' : ''}
                        \${link.smartRules ? '<span class="badge badge-warning">🧠 智能</span>' : ''}
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
// 4. API 处理 (增强版)
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

    // 创建短链接 (增强版)
    if (path === '/api/create' && request.method === 'POST') {
        try {
            const body = await request.json();
            const { 
                content, customCode, redirectType, delay, password, ttl, maxClicks, rawDisplay,
                smartRules, mask, trackAnalytics, noReferrer, noFollow, note
            } = body;

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

            // 验证智能路由规则
            let validatedSmartRules = null;
            if (smartRules) {
                const rules = {};
                
                // 设备规则 - 验证 URL
                if (smartRules.mobile && formatUrl(smartRules.mobile).isValid) {
                    rules.mobile = formatUrl(smartRules.mobile).url;
                }
                if (smartRules.desktop && formatUrl(smartRules.desktop).isValid) {
                    rules.desktop = formatUrl(smartRules.desktop).url;
                }
                if (smartRules.tablet && formatUrl(smartRules.tablet).isValid) {
                    rules.tablet = formatUrl(smartRules.tablet).url;
                }
                
                // 地理规则
                if (smartRules.geo && smartRules.geo.length > 0) {
                    rules.geo = smartRules.geo
                        .filter(g => g.country && g.url && formatUrl(g.url).isValid)
                        .map(g => ({ country: g.country.toUpperCase(), url: formatUrl(g.url).url }));
                    if (rules.geo.length === 0) delete rules.geo;
                }
                
                // A/B 测试规则
                if (smartRules.ab && smartRules.ab.length > 0) {
                    const validAb = smartRules.ab
                        .filter(a => a.weight > 0 && a.url && formatUrl(a.url).isValid)
                        .map(a => ({ weight: a.weight, url: formatUrl(a.url).url }));
                    if (validAb.length > 0) {
                        // 归一化权重
                        const totalWeight = validAb.reduce((sum, a) => sum + a.weight, 0);
                        rules.ab = validAb.map(a => ({ 
                            weight: Math.round((a.weight / totalWeight) * 100),
                            url: a.url 
                        }));
                    }
                }
                
                if (Object.keys(rules).length > 0) {
                    validatedSmartRules = rules;
                }
            }

            // 验证伪装配置
            let validatedMask = null;
            if (mask && mask.domain) {
                const domain = mask.domain.trim();
                const path = mask.path || '/';
                if (domain && /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(domain)) {
                    validatedMask = { domain, path };
                }
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
                uniqueVisitors: 0,
                // 新增字段
                smartRules: validatedSmartRules,
                mask: validatedMask,
                trackAnalytics: trackAnalytics !== false,
                noReferrer: noReferrer || false,
                noFollow: noFollow || false,
                note: note || null
            };

            await env.LINKS_KV.put(shortCode, JSON.stringify(linkData), kvOptions);

            // 如果有伪装，生成伪装链接
            let shortUrl = `${new URL(request.url).origin}/${shortCode}`;
            if (validatedMask) {
                // 使用伪装域名 + 真实短码作为路径
                shortUrl = `https://${validatedMask.domain}${validatedMask.path}${shortCode}`;
            }

            return new Response(JSON.stringify({
                success: true,
                shortUrl: shortUrl,
                shortCode: shortCode,
                isUrl: linkData.isUrl,
                mask: validatedMask ? true : false
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } catch (err) {
            return new Response(JSON.stringify({ success: false, error: '服务器错误: ' + err.message }), { status: 500, headers: corsHeaders });
        }
    }

    // 获取统计数据 (增强版)
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
                devices: data.devices || {},
                mask: data.mask || null,
                smartRules: data.smartRules ? true : false,
                note: data.note || null
            }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 列出所有链接 (增强版)
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
                        isExpired: isExpired,
                        mask: !!parsed.mask,
                        smartRules: !!parsed.smartRules
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
// 5. 处理短链接访问 (增强版 - 智能路由 + 伪装)
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
        const url = new URL(request.url);
        const reqPassword = url.searchParams.get('pwd') || 
                           (request.method === 'POST' ? (await request.formData()).get('pwd') : null);
        if (reqPassword !== linkData.password) {
            return handlePasswordPage(shortCode);
        }
    }

    // ===== 智能路由逻辑 =====
    let targetUrl = linkData.content;
    let usedSmartRule = null;

    if (linkData.smartRules) {
        const rules = linkData.smartRules;
        const userAgent = request.headers.get('user-agent') || '';
        const deviceType = getDeviceType(userAgent);
        const country = getCountry(request);

        // 1. 设备规则 (优先级最高)
        if (deviceType === 'mobile' && rules.mobile) {
            targetUrl = rules.mobile;
            usedSmartRule = 'mobile';
        } else if (deviceType === 'tablet' && rules.tablet) {
            targetUrl = rules.tablet;
            usedSmartRule = 'tablet';
        } else if (deviceType === 'desktop' && rules.desktop) {
            targetUrl = rules.desktop;
            usedSmartRule = 'desktop';
        }

        // 2. 地理规则 (如果设备规则未命中)
        if (!usedSmartRule && rules.geo) {
            const matchedGeo = rules.geo.find(g => g.country === country);
            if (matchedGeo) {
                targetUrl = matchedGeo.url;
                usedSmartRule = 'geo:' + country;
            }
        }

        // 3. A/B 测试 (如果前面的规则都未命中)
        if (!usedSmartRule && rules.ab && rules.ab.length > 0) {
            const random = Math.random() * 100;
            let cumulative = 0;
            for (const ab of rules.ab) {
                cumulative += ab.weight;
                if (random <= cumulative) {
                    targetUrl = ab.url;
                    usedSmartRule = 'ab:' + ab.weight + '%';
                    break;
                }
            }
        }
    }

    // ===== 异步更新统计 =====
    ctx.waitUntil((async () => {
        if (linkData.trackAnalytics !== false) {
            const clientIP = getClientIP(request);
            
            linkData.clicks = (linkData.clicks || 0) + 1;
            linkData.lastAccessedAt = new Date().toISOString();

            if (!linkData.visitors) linkData.visitors = [];
            if (!linkData.visitors.includes(clientIP)) {
                linkData.visitors.push(clientIP);
                linkData.uniqueVisitors = linkData.visitors.length;
            }

            const ref = request.headers.get('referer');
            if (ref) {
                try {
                    const host = new URL(ref).hostname;
                    linkData.referrers[host] = (linkData.referrers[host] || 0) + 1;
                } catch (_) {}
            }

            const country = request.cf?.country || '其他';
            linkData.countries[country] = (linkData.countries[country] || 0) + 1;

            const userAgent = request.headers.get('user-agent') || '';
            let device = '其他';
            if (/mobile/i.test(userAgent)) device = '移动端';
            else if (/tablet/i.test(userAgent)) device = '平板';
            else if (/bot|crawler|spider/i.test(userAgent)) device = '爬虫';
            else device = '桌面端';
            linkData.devices[device] = (linkData.devices[device] || 0) + 1;

            // 记录使用的智能路由规则
            if (usedSmartRule) {
                if (!linkData.smartUsage) linkData.smartUsage = {};
                linkData.smartUsage[usedSmartRule] = (linkData.smartUsage[usedSmartRule] || 0) + 1;
            }
        }

        await env.LINKS_KV.put(shortCode, JSON.stringify(linkData));
    })());

    // ===== 跳转逻辑 =====
    if (linkData.isUrl && !linkData.rawDisplay) {
        // 构建跳转响应
        let status = linkData.redirectType || 302;
        const headers = new Headers();
        headers.set('Location', targetUrl);
        
        // 隐私设置
        if (linkData.noReferrer) {
            headers.set('Referrer-Policy', 'no-referrer');
        }
        
        // SEO 设置
        if (linkData.noFollow) {
            // 仅对 HTML 页面有效，重定向不影响
        }

        if (linkData.delay > 0) {
            return handleDelayRedirectPage(targetUrl, linkData.delay, shortCode);
        }

        // 伪装：如果启用，在重定向时保留伪装域名
        if (linkData.mask) {
            // 使用伪装域名作为显示，但实际跳转不变
            // 通过 HTML 页面展示伪装效果
            return handleMaskedRedirectPage(targetUrl, linkData.mask, shortCode, status);
        }

        return new Response(null, { status, headers });
    }

    if (linkData.rawDisplay) {
        return new Response(linkData.content, { 
            headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
        });
    } else {
        return handleTextContentPage(linkData.content, shortCode, linkData.clicks + 1);
    }
}

// ===== 伪装重定向页面 =====
function handleMaskedRedirectPage(targetUrl, mask, shortCode, status) {
    return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0;url=${targetUrl}">
    <title>${mask.domain}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0a1a;
            color: #fff;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            text-align: center;
        }
        .container {
            max-width: 500px;
            padding: 40px;
        }
        .domain {
            font-size: 24px;
            color: #6C63FF;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .path {
            color: rgba(255,255,255,0.4);
            font-size: 14px;
            margin-bottom: 20px;
            font-family: monospace;
        }
        .loader {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(108,99,255,0.1);
            border-top: 3px solid #6C63FF;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .note {
            color: rgba(255,255,255,0.3);
            font-size: 12px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="domain">${mask.domain}</div>
        <div class="path">${mask.path}${shortCode}</div>
        <div class="loader"></div>
        <p style="color:rgba(255,255,255,0.5);font-size:14px;">正在跳转...</p>
        <div class="note">🔗 短链接 ULTRA v2.0</div>
    </div>
    <script>
        // 立即跳转
        window.location.href = "${targetUrl}";
    </script>
</body>
</html>`, { 
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' } 
    });
}

// ===== 密码页面 =====
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

// ===== 延迟跳转页面 =====
function handleDelayRedirectPage(targetUrl, delaySeconds, shortCode) {
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

// ===== 文本内容页面 =====
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
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn-secondary" onclick="navigator.clipboard.writeText('${content.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}').then(()=>alert('已复制'))" style="padding:6px 14px;font-size:12px;">📋 复制内容</button>
            <a href="/" class="btn-primary" style="display:inline-block;width:auto;padding:8px 18px;text-decoration:none;font-size:13px;">⚡ 创建短链接</a>
        </div>
    </div>
</div>
</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
