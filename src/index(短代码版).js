// ============================================================
//  Short Link Generator ULTRA Pro (Cloudflare Worker)
//  支持：链接伪装 | 设备分流 | 地理路由 | 智能统计 | 密码保护
// ============================================================

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (path === '/') return handleHomePage();
        if (path === '/stats' || path.startsWith('/stats/')) return handleStatsPage();
        if (path === '/manage') return handleManagePage();
        if (path.startsWith('/api/')) return handleAPI(request, env, path);

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
        if (!/^https?:\/\//i.test(str)) str = 'https://' + str;
        new URL(str);
        return { isValid: true, url: str };
    } catch (_) {
        return { isValid: false, url: string };
    }
}

function getClientIP(request) {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For')?.split(',')[0] || 
           'unknown';
}

function getDeviceType(userAgent) {
    const ua = userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    if (/tablet|ipad/.test(ua)) return 'tablet';
    if (/bot|spider|crawler/.test(ua)) return 'bot';
    return 'desktop';
}

// ------------------------------------------------------------
// 🎨 公共 CSS 样式
// ------------------------------------------------------------
const COMMON_STYLE = `
    :root {
        --primary: #6C63FF; --primary-dark: #4A42D9; --secondary: #FF6B6B;
        --success: #51CF66; --warning: #FFD93D; --info: #4DABF7;
        --bg-dark: #0a0a1a; --bg-card: rgba(255, 255, 255, 0.06);
        --text-primary: #ffffff; --text-secondary: rgba(255, 255, 255, 0.7);
        --text-muted: rgba(255, 255, 255, 0.4); --border-color: rgba(255, 255, 255, 0.1);
        --shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); --radius: 16px;
    }
    [data-theme="light"] {
        --bg-dark: #f0f2f5; --bg-card: rgba(255, 255, 255, 0.85);
        --text-primary: #1a1a2e; --text-secondary: rgba(0, 0, 0, 0.7);
        --text-muted: rgba(0, 0, 0, 0.4); --border-color: rgba(0, 0, 0, 0.1);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: var(--bg-dark); min-height: 100vh; display: flex; justify-content: center; padding: 20px; color: var(--text-primary); }
    .glass-card { background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 30px; width: 100%; max-width: 820px; box-shadow: var(--shadow); }
    .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .logo { display: flex; align-items: center; gap: 10px; }
    .logo-icon { width: 40px; height: 40px; background: linear-gradient(135deg, var(--primary), var(--secondary)); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    h1 { font-size: 1.5rem; background: linear-gradient(135deg, var(--primary), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .nav-btn, .theme-toggle { background: var(--bg-card); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 8px; cursor: pointer; color: var(--text-secondary); font-size: 13px; }
    .nav-btn:hover { background: rgba(108, 99, 255, 0.2); color: #fff; }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 13px; color: var(--text-secondary); }
    input, textarea, select { width: 100%; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 10px; background: rgba(255, 255, 255, 0.05); color: var(--text-primary); font-size: 14px; outline: none; }
    input:focus, textarea:focus, select:focus { border-color: var(--primary); }
    select option { background: #1a1a2e; color: #fff; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .btn-primary { width: 100%; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; border: none; padding: 12px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover { opacity: 0.9; }
    .section-title { font-size: 14px; font-weight: 700; color: var(--primary); margin: 18px 0 10px 0; border-bottom: 1px dashed var(--border-color); padding-bottom: 4px; }
    .result-box { margin-top: 20px; padding: 20px; background: rgba(108, 99, 255, 0.1); border: 1px solid var(--primary); border-radius: 12px; display: none; }
    .result-box.show { display: block; }
    .badge { background: rgba(108, 99, 255, 0.2); color: var(--primary); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-success { background: rgba(81, 207, 102, 0.2); color: var(--success); }
    .badge-danger { background: rgba(255, 107, 107, 0.2); color: var(--secondary); }
    @media (max-width: 640px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }
`;

// ------------------------------------------------------------
// 1. 首页 UI (支持伪装/路由设置)
// ------------------------------------------------------------
function handleHomePage() {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>短链接生成器 ULTRA Pro</title>
    <style>${COMMON_STYLE}</style>
</head>
<body>
    <div class="glass-card">
        <div class="header-bar">
            <div class="logo"><div class="logo-icon">🚀</div><h1>短链接 ULTRA Pro</h1></div>
            <div>
                <button class="nav-btn" onclick="location.href='/stats'">📊 统计</button>
                <button class="nav-btn" onclick="location.href='/manage'">📋 管理</button>
                <button class="theme-toggle" onclick="toggleTheme()">🌓</button>
            </div>
        </div>

        <form id="linkForm">
            <div class="form-group">
                <label for="content">📎 默认目标 URL / 文本内容 *</label>
                <textarea id="content" placeholder="输入跳转链接 (https://...) 或长文本" required style="height:60px;"></textarea>
            </div>

            <div class="grid-2">
                <div class="form-group">
                    <label for="customCode">🔖 自定义后缀 (可选)</label>
                    <input type="text" id="customCode" placeholder="例如: my-link">
                </div>
                <div class="form-group">
                    <label for="redirectType">🔄 跳转类型</label>
                    <select id="redirectType">
                        <option value="302">302 临时跳转</option>
                        <option value="301">301 永久跳转</option>
                        <option value="iframe">🎭 网页伪装 (Iframe防红/不显原URL)</option>
                    </select>
                </div>
            </div>

            <!-- 高级功能 1：设备分流跳转 -->
            <div class="section-title">📱 设备智能分流跳转 (可选)</div>
            <div class="grid-2">
                <div class="form-group">
                    <label>🍎 iOS 跳转 URL</label>
                    <input type="url" id="iosUrl" placeholder="iOS 设备专用链接">
                </div>
                <div class="form-group">
                    <label>🤖 Android 跳转 URL</label>
                    <input type="url" id="androidUrl" placeholder="Android 设备专用链接">
                </div>
            </div>

            <!-- 高级功能 2：地理位置路由 -->
            <div class="section-title">🌐 地理路由分流 (格式: 国家代码=URL, 每行一条)</div>
            <div class="form-group">
                <textarea id="geoRules" placeholder="CN=https://china.example.com&#10;US=https://us.example.com" style="height:60px;font-family:monospace;"></textarea>
            </div>

            <!-- 高级功能 3：社交分享卡片伪装 -->
            <div class="section-title">🎭 链接伪装 (Social Meta OG)</div>
            <div class="grid-2">
                <div class="form-group">
                    <label>伪装标题 (Meta Title)</label>
                    <input type="text" id="cloakTitle" placeholder="微信/Telegram中显示的标题">
                </div>
                <div class="form-group">
                    <label>伪装缩略图 (Meta Image)</label>
                    <input type="url" id="cloakImage" placeholder="https://.../preview.jpg">
                </div>
            </div>

            <!-- 规则及限制设置 -->
            <div class="section-title">🔒 限制与有效控制</div>
            <div class="grid-3">
                <div class="form-group">
                    <label>⏱️ 延迟跳转(秒)</label>
                    <input type="number" id="delay" value="0" min="0">
                </div>
                <div class="form-group">
                    <label>⏳ 有效期(小时)</label>
                    <input type="number" id="ttl" placeholder="永久">
                </div>
                <div class="form-group">
                    <label>👆 最大访问次数</label>
                    <input type="number" id="maxClicks" placeholder="不限">
                </div>
            </div>
            <div class="form-group">
                <label>🔐 访问密码 (可选)</label>
                <input type="password" id="password" placeholder="留空不设密码">
            </div>

            <button type="submit" class="btn-primary" id="submitBtn">✨ 立即生成 Pro 链接</button>
        </form>

        <div id="result" class="result-box">
            <h3 style="color:var(--success);margin-bottom:8px;">✅ 短链接生成成功！</h3>
            <div style="display:flex;gap:10px;margin-bottom:10px;">
                <input type="text" id="shortUrl" readonly style="font-weight:bold;color:var(--primary);">
                <button onclick="copyUrl()" class="btn-primary" style="width:auto;padding:0 20px;">复制</button>
            </div>
            <div id="resultBadges" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
        </div>
    </div>

    <script>
        function toggleTheme() {
            document.body.setAttribute('data-theme', document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        }

        function copyUrl() {
            const input = document.getElementById('shortUrl');
            input.select();
            navigator.clipboard.writeText(input.value);
            alert('已复制到剪贴板！');
        }

        document.getElementById('linkForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');
            btn.disabled = true;

            // 解析 Geo 规则
            const geoRulesText = document.getElementById('geoRules').value.trim();
            const geoRules = {};
            if (geoRulesText) {
                geoRulesText.split('\\n').forEach(line => {
                    const [country, url] = line.split('=');
                    if (country && url) geoRules[country.trim().toUpperCase()] = url.trim();
                });
            }

            const payload = {
                content: document.getElementById('content').value.trim(),
                customCode: document.getElementById('customCode').value.trim(),
                redirectType: document.getElementById('redirectType').value,
                delay: parseInt(document.getElementById('delay').value) || 0,
                password: document.getElementById('password').value,
                ttl: parseInt(document.getElementById('ttl').value) || null,
                maxClicks: parseInt(document.getElementById('maxClicks').value) || null,
                
                // 新增高级字段
                deviceRoutes: {
                    ios: document.getElementById('iosUrl').value.trim(),
                    android: document.getElementById('androidUrl').value.trim()
                },
                geoRoutes: geoRules,
                cloaking: {
                    title: document.getElementById('cloakTitle').value.trim(),
                    image: document.getElementById('cloakImage').value.trim()
                }
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
                    document.getElementById('resultBadges').innerHTML = \`
                        <span class="badge">短码: \${data.shortCode}</span>
                        \${payload.redirectType === 'iframe' ? '<span class="badge badge-success">已开启网页伪装</span>' : ''}
                        \${Object.keys(geoRules).length ? '<span class="badge">已启用地理路由</span>' : ''}
                    \`;
                } else {
                    alert('错误: ' + data.error);
                }
            } catch (err) {
                alert('请求异常: ' + err.message);
            } finally {
                btn.disabled = false;
            }
        });
    </script>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ------------------------------------------------------------
// 2. 统计页面与管理 UI (逻辑与前版保持一致，兼容新增属性)
// ------------------------------------------------------------
function handleStatsPage() {
    return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>数据统计</title><style>${COMMON_STYLE}</style></head><body><div class="glass-card"><h1>📊 数据统计看板</h1><p style="margin-top:10px;">请通过后台 API 接口 /api/stats/{code} 获取 JSON 格式的全量多维数据统计。</p><a href="/" style="display:inline-block;margin-top:20px;color:var(--primary);">← 返回首页</a></div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function handleManagePage() {
    return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>后台管理</title><style>${COMMON_STYLE}</style></head><body><div class="glass-card"><h1>📋 链接管理列表</h1><p style="margin-top:10px;">可直接调用 /api/list 查看 KV 数据。</p><a href="/" style="display:inline-block;margin-top:20px;color:var(--primary);">← 返回首页</a></div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ------------------------------------------------------------
// 3. API 处理 (存储设备/地理路由及伪装规则)
// ------------------------------------------------------------
async function handleAPI(request, env, path) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    if (path === '/api/create' && request.method === 'POST') {
        try {
            const body = await request.json();
            const { content, customCode, redirectType, delay, password, ttl, maxClicks, deviceRoutes, geoRoutes, cloaking } = body;

            if (!content) return new Response(JSON.stringify({ success: false, error: '内容不能为空' }), { status: 400, headers: corsHeaders });

            let shortCode = customCode?.trim();
            const urlCheck = formatUrl(content);

            if (shortCode) {
                if (!/^[a-zA-Z0-9_-]+$/.test(shortCode)) return new Response(JSON.stringify({ success: false, error: '自定义后缀不合法' }), { status: 400, headers: corsHeaders });
                if (RESERVED_PATHS.includes(shortCode.toLowerCase())) return new Response(JSON.stringify({ success: false, error: '包含系统保留后缀' }), { status: 400, headers: corsHeaders });
                if (await env.LINKS_KV.get(shortCode)) return new Response(JSON.stringify({ success: false, error: '后缀已被占用' }), { status: 400, headers: corsHeaders });
            } else {
                shortCode = generateShortCode();
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
                redirectType: redirectType || '302',
                delay: delay || 0,
                password: password ? password.trim() : null,
                maxClicks: maxClicks || null,
                
                // 扩展的路由和伪装配置
                deviceRoutes: deviceRoutes || {},
                geoRoutes: geoRoutes || {},
                cloaking: cloaking || {},

                createdAt: new Date().toISOString(),
                expiresAt: expiresAt,
                clicks: 0,
                visitors: [],
                uniqueVisitors: 0,
                countries: {},
                devices: {}
            };

            await env.LINKS_KV.put(shortCode, JSON.stringify(linkData), kvOptions);

            return new Response(JSON.stringify({
                success: true,
                shortUrl: `${new URL(request.url).origin}/${shortCode}`,
                shortCode: shortCode
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } catch (err) {
            return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
        }
    }

    if (path.startsWith('/api/stats/')) {
        const code = path.substring('/api/stats/'.length);
        const data = await env.LINKS_KV.get(code);
        if (!data) return new Response(JSON.stringify({ success: false, error: '链接不存在' }), { status: 404, headers: corsHeaders });
        return new Response(data, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response('Not Found', { status: 404 });
}

// ------------------------------------------------------------
// 4. 核心处理：短链接访问 (设备分流 + 地理分流 + 链接伪装)
// ------------------------------------------------------------
async function handleShortLink(request, env, ctx, shortCode) {
    const linkDataStr = await env.LINKS_KV.get(shortCode);

    if (!linkDataStr) {
        return new Response('<h1>404 - 链接不存在或已失效</h1>', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const linkData = JSON.parse(linkDataStr);
    const userAgent = request.headers.get('user-agent') || '';
    const country = request.cf?.country || 'UNKNOWN';
    const device = getDeviceType(userAgent);

    // 1. 验证过期与访问上限
    if (linkData.expiresAt && new Date(linkData.expiresAt).getTime() < Date.now()) {
        return new Response('<h1>410 - 链接已过期</h1>', { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (linkData.maxClicks && linkData.clicks >= linkData.maxClicks) {
        return new Response('<h1>410 - 访问已达上限</h1>', { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // 2. 异步记录访问日志与统计
    ctx.waitUntil((async () => {
        const clientIP = getClientIP(request);
        linkData.clicks = (linkData.clicks || 0) + 1;
        
        if (!linkData.visitors) linkData.visitors = [];
        if (!linkData.visitors.includes(clientIP)) {
            linkData.visitors.push(clientIP);
            linkData.uniqueVisitors = linkData.visitors.length;
        }

        linkData.countries[country] = (linkData.countries[country] || 0) + 1;
        linkData.devices[device] = (linkData.devices[device] || 0) + 1;

        await env.LINKS_KV.put(shortCode, JSON.stringify(linkData));
    })());

    // 3. 计算最终的目标跳转 URL (路由优先级: 设备 > 地理 > 默认)
    let targetUrl = linkData.content;

    if (linkData.isUrl) {
        if (device === 'ios' && linkData.deviceRoutes?.ios) {
            targetUrl = linkData.deviceRoutes.ios;
        } else if (device === 'android' && linkData.deviceRoutes?.android) {
            targetUrl = linkData.deviceRoutes.android;
        } else if (linkData.geoRoutes && linkData.geoRoutes[country]) {
            targetUrl = linkData.geoRoutes[country];
        }
    }

    // 4. 处理链接伪装 (Cloaking / Meta 标签伪装 / Iframe 嵌入)
    if (linkData.isUrl) {
        // 模式 A: 网页框架伪装 (Iframe) - 隐藏真实域名
        if (linkData.redirectType === 'iframe') {
            const cloakTitle = linkData.cloaking?.title || '安全跳转中...';
            return new Response(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${cloakTitle}</title>
    <!-- OpenGraph 社交卡片伪装 -->
    <meta property="og:title" content="${cloakTitle}">
    <meta property="og:image" content="${linkData.cloaking?.image || ''}">
    <style>
        body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; }
        iframe { width: 100%; height: 100%; border: none; }
    </style>
</head>
<body>
    <iframe src="${targetUrl}"></iframe>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        // 模式 B: 带 Meta OG 卡片伪装的延迟/直接跳转
        if (linkData.cloaking?.title || linkData.cloaking?.image) {
            return new Response(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${linkData.cloaking.title || '跳转中...'}</title>
    <meta property="og:title" content="${linkData.cloaking.title || ''}">
    <meta property="og:image" content="${linkData.cloaking.image || ''}">
    <meta http-equiv="refresh" content="${linkData.delay || 0};url=${targetUrl}">
</head>
<body>
    <p>正在前往页面，请稍候...</p>
    <script>setTimeout(()=>{ window.location.href = "${targetUrl}"; }, ${(linkData.delay || 0) * 1000});</script>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        // 模式 C: 传统重定向 (301/302)
        return Response.redirect(targetUrl, parseInt(linkData.redirectType) || 302);
    }

    // 非 URL，返回纯文本
    return new Response(linkData.content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
