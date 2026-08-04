// ============================================================
//  Short Link Generator PRO Version (Cloudflare Worker)
// ============================================================

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // 1. 首页 (生成短链接 & 历史记录)
        if (path === '/') {
            return handleHomePage();
        }

        // 2. 统计页面
        if (path === '/stats' || path.startsWith('/stats/')) {
            return handleStatsPage();
        }

        // 3. API 路由
        if (path.startsWith('/api/')) {
            return handleAPI(request, env, path);
        }

        // 4. 短链接访问/跳转路由
        if (path.length > 1) {
            return handleShortLink(request, env, ctx, path.substring(1));
        }

        return new Response('404 Not Found', { status: 404 });
    }
};

// 系统保留后缀，防止路由冲突
const RESERVED_PATHS = ['api', 'stats', 'favicon.ico', 'robots.txt'];

// 随机生成短码
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

// ------------------------------------------------------------
// 🎨 前端 UI：公共 CSS 样式（现代化 Glassmorphism 风格）
// ------------------------------------------------------------
const COMMON_STYLE = `
    :root {
        --primary: #6366f1;
        --primary-hover: #4f46e5;
        --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%);
        --card-bg: rgba(255, 255, 255, 0.95);
        --text-color: #1e293b;
        --text-muted: #64748b;
        --border-color: #e2e8f0;
    }

    [data-theme="dark"] {
        --card-bg: rgba(30, 41, 59, 0.85);
        --text-color: #f8fafc;
        --text-muted: #94a3b8;
        --border-color: #334155;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    
    body {
        background: var(--bg-gradient);
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        color: var(--text-color);
        transition: background 0.3s;
    }

    .glass-card {
        background: var(--card-bg);
        backdrop-filter: blur(16px);
        border: 1px solid var(--border-color);
        border-radius: 24px;
        padding: 35px;
        width: 100%;
        max-width: 680px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
    }

    .header-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px;
    }

    h1 { font-size: 1.8rem; font-weight: 700; color: var(--text-color); }

    .theme-toggle {
        background: transparent;
        border: 1px solid var(--border-color);
        padding: 8px 12px;
        border-radius: 12px;
        cursor: pointer;
        color: var(--text-color);
        font-size: 14px;
    }

    .form-group { margin-bottom: 18px; }
    label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 14px; color: var(--text-color); }
    
    input[type="text"], input[type="password"], input[type="number"], textarea, select {
        width: 100%;
        padding: 12px 16px;
        border: 1px solid var(--border-color);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-color);
        font-size: 15px;
        outline: none;
        transition: all 0.2s;
    }

    input:focus, textarea:focus, select:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }

    textarea { min-height: 90px; resize: vertical; }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }

    .btn-primary {
        width: 100%;
        background: var(--primary);
        color: white;
        border: none;
        padding: 14px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
    }

    .btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); }
    .btn-primary:active { transform: translateY(0); }

    .result-box {
        margin-top: 20px;
        padding: 20px;
        background: rgba(99, 102, 241, 0.1);
        border: 1px solid var(--primary);
        border-radius: 16px;
        display: none;
    }

    .result-box.show { display: block; }

    .url-display {
        display: flex;
        gap: 10px;
        margin-top: 10px;
    }

    .copy-btn {
        background: #10b981;
        color: white;
        border: none;
        padding: 10px 18px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
        white-space: nowrap;
    }

    .history-section { margin-top: 30px; border-top: 1px solid var(--border-color); padding-top: 20px; }
    .history-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .history-list { list-style: none; max-height: 220px; overflow-y: auto; }
    .history-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid var(--border-color);
        font-size: 14px;
    }

    .badge {
        background: rgba(99, 102, 241, 0.15);
        color: var(--primary);
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 12px;
    }

    #toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 600;
        display: none;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }
`;

// ------------------------------------------------------------
// 1. 首页 UI (PRO 版)
// ------------------------------------------------------------
function handleHomePage() {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Short Link Generator PRO</title>
    <style>${COMMON_STYLE}</style>
</head>
<body>
    <div class="glass-card">
        <div class="header-bar">
            <h1>🔗 短链接生成器 PRO</h1>
            <button class="theme-toggle" onclick="toggleTheme()">🌓 切换模式</button>
        </div>

        <form id="linkForm">
            <div class="form-group">
                <label for="content">长网址或文本内容 *</label>
                <textarea id="content" placeholder="输入要缩短的 URL (例如 https://example.com) 或任意文本..." required></textarea>
            </div>

            <div class="grid-2">
                <div class="form-group">
                    <label for="customCode">自定义后缀 (可选)</label>
                    <input type="text" id="customCode" placeholder="如: my-link" maxlength="20">
                </div>
                <div class="form-group">
                    <label for="redirectType">跳转重定向类型</label>
                    <select id="redirectType">
                        <option value="302">302 临时重定向 (默认)</option>
                        <option value="301">301 永久重定向</option>
                        <option value="307">307 严格重定向</option>
                    </select>
                </div>
            </div>

            <div class="grid-2">
                <div class="form-group">
                    <label for="delay">中间页跳转延迟 (秒)</label>
                    <input type="number" id="delay" placeholder="0 表示直接跳转" min="0" max="60" value="0">
                </div>
                <div class="form-group">
                    <label for="password">访问密码保护 (可选)</label>
                    <input type="password" id="password" placeholder="留空则不设密码">
                </div>
            </div>

            <div class="grid-2">
                <div class="form-group">
                    <label for="ttl">有效期限 (小时)</label>
                    <input type="number" id="ttl" placeholder="留空表示永久有效" min="1">
                </div>
                <div class="form-group" style="display: flex; align-items: center; margin-top: 25px;">
                    <input type="checkbox" id="rawDisplay" style="width: 18px; height: 18px; margin-right: 8px;">
                    <label for="rawDisplay" style="margin: 0; cursor: pointer;">纯文本展示模式</label>
                </div>
            </div>

            <button type="submit" class="btn-primary" id="submitBtn">🚀 立即生成短链接</button>
        </form>

        <div id="result" class="result-box">
            <h3 style="color: #10b981; margin-bottom: 5px;">🎉 生成成功！</h3>
            <div class="url-display">
                <input type="text" id="shortUrl" readonly>
                <button class="copy-btn" onclick="copyToClipboard()">复制链接</button>
            </div>
        </div>

        <!-- 历史记录列表 -->
        <div class="history-section">
            <div class="history-title">
                <span style="font-weight: 600;">📜 本地生成历史</span>
                <button onclick="clearHistory()" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 13px;">清空历史</button>
            </div>
            <ul id="historyList" class="history-list">
                <li style="color: var(--text-muted); font-size: 13px;">暂无历史记录。</li>
            </ul>
        </div>

        <div style="text-align: center; margin-top: 25px;">
            <a href="/stats" style="color: var(--primary); text-decoration: none; font-size: 14px; font-weight: 600;">📊 进入数据分析看板 →</a>
        </div>
    </div>

    <div id="toast">已成功复制到剪贴板！</div>

    <script>
        document.addEventListener('DOMContentLoaded', loadHistory);

        function toggleTheme() {
            const current = document.body.getAttribute('data-theme');
            document.body.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
        }

        function showToast(msg) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.style.display = 'block';
            setTimeout(() => { toast.style.display = 'none'; }, 2000);
        }

        document.getElementById('linkForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');
            btn.disabled = true;
            btn.textContent = '生成中...';

            const payload = {
                content: document.getElementById('content').value,
                customCode: document.getElementById('customCode').value,
                redirectType: parseInt(document.getElementById('redirectType').value),
                delay: parseInt(document.getElementById('delay').value) || 0,
                password: document.getElementById('password').value,
                ttl: parseInt(document.getElementById('ttl').value) || null,
                rawDisplay: document.getElementById('rawDisplay').checked
            };

            try {
                const res = await fetch('/api/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    document.getElementById('shortUrl').value = data.shortUrl;
                    document.getElementById('result').classList.add('show');
                    saveToHistory(data.shortCode, data.shortUrl, payload.content);
                    showToast('短链接已生成！');
                } else {
                    alert('生成失败: ' + data.error);
                }
            } catch (err) {
                alert('网络错误: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = '🚀 立即生成短链接';
            }
        });

        function copyToClipboard() {
            const val = document.getElementById('shortUrl').value;
            navigator.clipboard.writeText(val).then(() => showToast('复制成功！'));
        }

        function saveToHistory(code, url, content) {
            let history = JSON.parse(localStorage.getItem('short_history') || '[]');
            history.unshift({ code, url, content: content.substring(0, 30), time: new Date().toLocaleDateString() });
            if (history.length > 20) history.pop();
            localStorage.setItem('short_history', JSON.stringify(history));
            loadHistory();
        }

        function loadHistory() {
            const list = document.getElementById('historyList');
            const history = JSON.parse(localStorage.getItem('short_history') || '[]');
            if (history.length === 0) {
                list.innerHTML = '<li style="color: var(--text-muted); font-size: 13px;">暂无历史记录。</li>';
                return;
            }
            list.innerHTML = history.map(item => \`
                <li class="history-item">
                    <div>
                        <a href="\${item.url}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: none;">/\${item.code}</a>
                        <span style="color: var(--text-muted); margin-left: 8px;">(\${item.content}...)</span>
                    </div>
                    <a href="/stats?code=\${item.code}" class="badge" style="text-decoration: none;">数据分析</a>
                </li>
            \`).join('');
        }

        function clearHistory() {
            localStorage.removeItem('short_history');
            loadHistory();
        }
    </script>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ------------------------------------------------------------
// 2. 统计数据看板 UI
// ------------------------------------------------------------
function handleStatsPage() {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>数据分析看板 - Short Link PRO</title>
    <style>
        ${COMMON_STYLE}
        .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
        .stat-card { background: rgba(99, 102, 241, 0.08); padding: 15px; border-radius: 12px; text-align: center; }
        .stat-card .num { font-size: 1.8rem; font-weight: 700; color: var(--primary); }
        .stat-card .title { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
        .detail-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color); font-size: 14px; }
    </style>
</head>
<body>
    <div class="glass-card">
        <div class="header-bar">
            <h1>📊 数据分析看板</h1>
            <button class="theme-toggle" onclick="toggleTheme()">🌓 切换模式</button>
        </div>

        <div class="form-group">
            <label for="searchCode">请输入短码进行查询</label>
            <div class="url-display">
                <input type="text" id="searchCode" placeholder="如: my-link 或 6位随机码">
                <button class="copy-btn" style="background: var(--primary);" onclick="fetchStats()">查询统计</button>
            </div>
        </div>

        <div id="statsResult" class="result-box">
            <div class="stat-grid">
                <div class="stat-card">
                    <div class="num" id="totalClicks">0</div>
                    <div class="title">累计总点击</div>
                </div>
                <div class="stat-card">
                    <div class="num" id="typeDisplay" style="font-size: 1.2rem;">-</div>
                    <div class="title">类型</div>
                </div>
                <div class="stat-card">
                    <div class="num" id="statusDisplay" style="font-size: 1.2rem;">-</div>
                    <div class="title">状态</div>
                </div>
            </div>

            <div class="detail-item"><span>短码:</span><span id="resCode" style="font-weight:600;">-</span></div>
            <div class="detail-item"><span>创建时间:</span><span id="resCreated">-</span></div>
            <div class="detail-item"><span>最后访问:</span><span id="resLastAccess">-</span></div>
            <div class="detail-item"><span>过期时间:</span><span id="resExpire">-</span></div>
            <div class="detail-item"><span>地区 Top:</span><span id="resCountries" class="badge">-</span></div>
            <div class="detail-item"><span>来源 Referer Top:</span><span id="resReferrers" class="badge">-</span></div>
        </div>

        <div style="text-align: center; margin-top: 25px;">
            <a href="/" style="color: var(--primary); text-decoration: none; font-size: 14px; font-weight: 600;">← 返回短链接生成器</a>
        </div>
    </div>

    <script>
        function toggleTheme() {
            const current = document.body.getAttribute('data-theme');
            document.body.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
        }

        document.addEventListener('DOMContentLoaded', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            if (code) {
                document.getElementById('searchCode').value = code;
                fetchStats();
            }
        });

        async function fetchStats() {
            const code = document.getElementById('searchCode').value.trim();
            if (!code) return alert('请输入短码');

            try {
                const res = await fetch(\`/api/stats/\${code}\`);
                const data = await res.json();

                if (data.success) {
                    const s = data.stats;
                    document.getElementById('totalClicks').textContent = s.clicks;
                    document.getElementById('typeDisplay').textContent = s.isUrl ? '网址重定向' : '纯文本';
                    document.getElementById('statusDisplay').textContent = s.isExpired ? '已过期' : '正常';
                    document.getElementById('resCode').textContent = s.shortCode;
                    document.getElementById('resCreated').textContent = new Date(s.createdAt).toLocaleString();
                    document.getElementById('resLastAccess').textContent = s.lastAccessedAt ? new Date(s.lastAccessedAt).toLocaleString() : '暂无访问';
                    document.getElementById('resExpire').textContent = s.expiresAt ? new Date(s.expiresAt).toLocaleString() : '永久有效';
                    
                    document.getElementById('resCountries').textContent = formatTop(s.countries);
                    document.getElementById('resReferrers').textContent = formatTop(s.referrers);

                    document.getElementById('statsResult').classList.add('show');
                } else {
                    alert('获取失败: ' + data.error);
                }
            } catch (err) {
                alert('网络错误: ' + err.message);
            }
        }

        function formatTop(obj) {
            if (!obj || Object.keys(obj).length === 0) return '无数据';
            return Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>\`\${k}: \${v}次\`).join(' | ');
        }
    </script>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ------------------------------------------------------------
// 3. 后端 API 处理
// ------------------------------------------------------------
async function handleAPI(request, env, path) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    // API: 创建短链接
    if (path === '/api/create' && request.method === 'POST') {
        try {
            const body = await request.json();
            const { content, customCode, redirectType, delay, password, ttl, rawDisplay } = body;

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
                    return new Response(JSON.stringify({ success: false, error: '该后缀为系统保留保留字' }), { status: 400, headers: corsHeaders });
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

            // 计算过期时间（秒）
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
                rawDisplay: rawDisplay || false,
                createdAt: new Date().toISOString(),
                expiresAt: expiresAt,
                clicks: 0,
                lastAccessedAt: null,
                referrers: {},
                countries: {}
            };

            await env.LINKS_KV.put(shortCode, JSON.stringify(linkData), kvOptions);

            const shortUrl = `${new URL(request.url).origin}/${shortCode}`;

            return new Response(JSON.stringify({
                success: true,
                shortUrl: shortUrl,
                shortCode: shortCode
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } catch (err) {
            return new Response(JSON.stringify({ success: false, error: '服务器错误' }), { status: 500, headers: corsHeaders });
        }
    }

    // API: 获取统计数据
    if (path.startsWith('/api/stats/') && request.method === 'GET') {
        const code = path.substring('/api/stats/'.length);
        const linkDataStr = await env.LINKS_KV.get(code);

        if (!linkDataStr) {
            return new Response(JSON.stringify({ success: false, error: '短链接不存在或已过期失效' }), { status: 404, headers: corsHeaders });
        }

        const data = JSON.parse(linkDataStr);
        return new Response(JSON.stringify({
            success: true,
            stats: {
                shortCode: code,
                clicks: data.clicks || 0,
                createdAt: data.createdAt,
                lastAccessedAt: data.lastAccessedAt,
                expiresAt: data.expiresAt,
                isUrl: data.isUrl,
                referrers: data.referrers || {},
                countries: data.countries || {}
            }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response('API Not Found', { status: 404 });
}

// ------------------------------------------------------------
// 4. 处理短链接跳转与访问 (重定向 / 密码验证 / 延迟中间页)
// ------------------------------------------------------------
async function handleShortLink(request, env, ctx, shortCode) {
    const linkDataStr = await env.LINKS_KV.get(shortCode);

    if (!linkDataStr) {
        return new Response('<h1>404 短链接不存在或已过期</h1>', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const linkData = JSON.parse(linkDataStr);
    const url = new URL(request.url);

    // 1. 密码验证逻辑
    if (linkData.password) {
        const reqPassword = url.searchParams.get('pwd') || (request.method === 'POST' ? (await request.formData()).get('pwd') : null);
        if (reqPassword !== linkData.password) {
            return handlePasswordPage(shortCode);
        }
    }

    // 2. 异步更新访问统计（不阻碍跳转速度）
    ctx.waitUntil((async () => {
        linkData.clicks = (linkData.clicks || 0) + 1;
        linkData.lastAccessedAt = new Date().toISOString();

        const ref = request.headers.get('referer');
        if (ref) {
            try {
                const host = new URL(ref).hostname;
                linkData.referrers[host] = (linkData.referrers[host] || 0) + 1;
            } catch (_) {}
        }

        const country = request.cf?.country || '其他';
        linkData.countries[country] = (linkData.countries[country] || 0) + 1;

        await env.LINKS_KV.put(shortCode, JSON.stringify(linkData));
    })());

    // 3. 跳转逻辑判断
    if (linkData.isUrl && !linkData.rawDisplay) {
        // 中间页延迟跳转
        if (linkData.delay > 0) {
            return handleDelayRedirectPage(linkData.content, linkData.delay);
        }
        // HTTP 状态码直接重定向 (301 / 302 / 307)
        return Response.redirect(linkData.content, linkData.redirectType || 302);
    }

    // 4. 纯文本展示
    if (linkData.rawDisplay) {
        return new Response(linkData.content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    } else {
        return handleTextContentPage(linkData.content, shortCode, linkData.clicks + 1);
    }
}

// 密码输入页面
function handlePasswordPage(shortCode) {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>密码保护 - Short Link PRO</title>
    <style>${COMMON_STYLE}</style>
</head>
<body>
    <div class="glass-card" style="max-width:400px; text-align:center;">
        <h2>🔒 访问受密码保护</h2>
        <p style="color:var(--text-muted); margin: 10px 0 20px 0; font-size:14px;">请输入访问密码以获取链接内容</p>
        <form method="POST">
            <div class="form-group">
                <input type="password" name="pwd" placeholder="请输入密码" required autofocus>
            </div>
            <button type="submit" class="btn-primary">解锁并访问</button>
        </form>
    </div>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// 延迟中间跳转页
function handleDelayRedirectPage(targetUrl, delaySeconds) {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>即将跳转... - Short Link PRO</title>
    <style>${COMMON_STYLE}</style>
</head>
<body>
    <div class="glass-card" style="max-width:480px; text-align:center;">
        <h2>🚀 即将为你跳转到目标页面</h2>
        <div style="font-size: 3rem; font-weight:700; color:var(--primary); margin: 20px 0;" id="countdown">${delaySeconds}</div>
        <p style="color:var(--text-muted); font-size:14px; word-break:break-all;">目标网址: ${targetUrl}</p>
        <br>
        <a href="${targetUrl}" class="btn-primary" style="display:inline-block; text-decoration:none;">立即手动跳转</a>
    </div>

    <script>
        let left = ${delaySeconds};
        const timer = setInterval(() => {
            left--;
            document.getElementById('countdown').textContent = left;
            if (left <= 0) {
                clearInterval(timer);
                window.location.href = "${targetUrl}";
            }
        }, 1000);
    </script>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// 文本展示页
function handleTextContentPage(content, shortCode, clicks) {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>短链接文本内容</title>
    <style>${COMMON_STYLE}</style>
</head>
<body>
    <div class="glass-card">
        <div class="header-bar">
            <h2>📄 文本内容查看</h2>
            <span class="badge">短码: ${shortCode}</span>
        </div>
        <div style="background:rgba(0,0,0,0.05); padding:20px; border-radius:12px; white-space:pre-wrap; word-break:break-all; margin: 15px 0;">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        <p style="color:var(--text-muted); text-align:center; font-size:14px;">👁️ 累计浏览次数: ${clicks}</p>
        <div style="text-align:center; margin-top:20px;">
            <a href="/" class="btn-primary" style="display:inline-block; width:auto; padding:10px 20px; text-decoration:none;">创建我的短链接</a>
        </div>
    </div>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
