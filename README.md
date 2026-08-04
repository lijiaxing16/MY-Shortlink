# Cloudflare 短链服务

# 基于Cloudflare Workers和KV存储的免费短链接服务，支持URL缩短和任意文本内容存储。

# 

# 特色

# 🔗 URL缩短：将长URL转换为短链接，并自动重定向

# 📝 文本内容存储：存储任何文本内容并生成短链接以便访问

# 🎯 自定义短代码：支持自定义短链接后缀

# 📊 访问统计数据：跟踪每个短链接的点击数

# 🚀 免费部署：完全基于Cloudflare的免费服务

# 📱 响应式设计：支持桌面和移动设备

# 技术栈

# Cloudflare Workers：无服务器计算平台

# Cloudflare KV：键值存储数据库KV namespace："LINKS\_KV"

# 原版JavaScript：无需额外框架

# 现代CSS：渐变背景与响应式布局

#详细部署步骤：
#这里是针对上述 Short Link ULTRA Pro 代码的详细部署与配置指南。
#🛠️ 第一步：准备 Cloudflare 账号与 KV 数据库
登录 Cloudflare
进入 Cloudflare Dashboard 首页。
创建 KV 命名空间（存储数据）
在左侧导航栏点击 Workers 与 Pages $\rightarrow$ KV。
点击 创建命名空间。
名称填写：LINKS_KV（或其他自定义名称），点击 添加。
#⚡ 第二步：创建并部署 Cloudflare Worker
创建 Worker

在左侧导航栏点击 Workers 与 Pages $\rightarrow$ 概述。
点击 创建应用程序 $\rightarrow$ 创建 Worker。
输入 Worker 名称（例如 my-short-link），点击 部署。
粘贴优化后的代码

部署完成后，点击 编辑代码（Edit Code）。
清空原有内容，将上方提供的 完整 JavaScript 代码 全部粘贴进去。
点击右上角 保存并部署（Save and Deploy）。
#🔗 第三步：绑定 KV 命名空间（关键）
如果不绑定 KV 数据库，短链接将无法保存与读取。

返回你的 Worker 设置页面：点击 Worker 名称 $\rightarrow$ 设置（Settings）$\rightarrow$ 变量（Variables）。
找到 KV 命名空间绑定（KV Namespace Bindings），点击 添加绑定。
参数设置如下：
变量名称 (Variable name)：必须严格填写为 LINKS_KV
KV 命名空间 (KV namespace)：选择你在第一步创建的 KV 实例。
点击 保存并部署。
#🌐 第四步：绑定自定义域名（可选，推荐）
Cloudflare 默认提供的 *.workers.dev 域名在部分地区或社交软件内可能会受到限制。推荐绑定你自己的域名：
进入 Worker 页面 $\rightarrow$ 设置 $\rightarrow$ 触发器（Triggers）。
点击 添加自定义域名（Custom Domain）。
输入你已托管在 Cloudflare 上的二级域名（例如 s.yourdomain.com）。
点击 绑定域名，Cloudflare 会自动解析并配置 SSL 证书。
#🎯 高级功能使用指南
#功能模块	使用说明
#🎭 链接伪装 (Iframe)	在下拉框中选择 网页伪装 (Iframe防红/不显原URL)。生成后访问者在浏览器地址栏只会看到你的短链接地址，网页内容则全屏加载目标网址。
#📱 设备智能路由	填入 iOS / Android 的专属跳转链接。例如：iPhone 用户访问时会自动跳向 App Store，Android 用户访问时跳向应用宝。
#🌐 地理路由分流	在规则框中输入 国家二字代码=目标URL（每行一条）。
示例：
CN=[https://china.site.com](https://china.site.com)
US=[https://us.site.com](https://us.site.com)
🖼️ 社交卡片伪装	填入伪装标题和预览图片 URL。当将短网址发送至微信、QQ、Telegram、X (Twitter) 时，会自动展示设置好的图文卡片。


# 免费分级限制

# Cloudflare 免费套餐包括：

# 

# 工人：每天10万个请求

# KV存储：100,000次读取操作，1,000次写操作

# 存储空间：1GB

# 这对个人使用来说完全足够。

# 部署步骤

# 1、登录Cloudflare

# 2、 创建KV命名空间

# &#x20;创建KV命名空间：“LINKS\_KV”

# 3、打开WORKER\&PAGES-创建应用程序-选择从hello world开始-部署。

# 4.打开编辑代码，粘贴index.js中的代码，点击部署。

# 5\. 绑定KV命名空间，KV变量名称必须是：“LINKS\_KV”

# 6\. 点击链接即可访问短链接生成器。


# 注释

# 短代码区分大小写

# 自定义短代码不能与系统路由冲突（如“api”）

# 建议定期备份重要的短链接数据

# 对于生产环境，建议绑定自定义域

# 许可

# 麻省理工学院许可

