# simusites.com 上线设置（需要你本人在各网站上点的步骤）

按顺序做。每做完一步告诉我，我会检查是否生效，再接着做代码和测试。
**任何密钥（以 `sk_`、`whsec_`、`re_` 开头的）都不要发在聊天里**：直接填进下面写明的网站设置里。
`price_` 开头的价格 ID 不是密钥，可以发给我。

---

## 第 1 步：把域名交给 Cloudflare 管理（先做，生效需要几分钟到 24 小时）

1. 打开 dash.cloudflare.com，注册并登录。
2. 首页点 **Add a domain**（或 “Onboard a domain”），输入 `simusites.com`，选 **Free** 套餐，一路 Continue。
3. Cloudflare 会显示**两个 nameserver**（形如 `xxx.ns.cloudflare.com`），先留着这个页面。
4. 另开 GoDaddy：右上角 **My Products** → 找到 simusites.com → **DNS** → **Nameservers** → **Change Nameservers**
   → 选 **I'll use my own nameservers** → 填入 Cloudflare 的那两个 → **Save**。
   - 如果 GoDaddy 提示 DNSSEC 已开启，先在 GoDaddy 关闭 DNSSEC。
5. 回到 Cloudflare 点 **Check nameservers**。生效后 Cloudflare 会发邮件告诉你 “simusites.com is now active”。

域名以后仍在 GoDaddy 续费；Cloudflare 只负责 DNS 和 HTTPS，免费。

## 第 2 步：用 Cloudflare Pages 托管网站

1. Cloudflare 左侧 **Workers & Pages** → **Create** → 选 **Pages** → **Connect to Git**。
2. 授权 GitHub，选仓库 `plotcloudstudio/plotcloud`。
3. 设置：
   - Production branch：`main`
   - Framework preset：**None**
   - Build command：留空
   - Build output directory：`/`
4. **Save and Deploy**。完成后会得到一个 `xxx.pages.dev` 地址，先发给我，我用它做测试。
5. 等第 1 步生效后，在这个 Pages 项目里 → **Custom domains** → **Set up a custom domain**，分别添加 `simusites.com` 和 `www.simusites.com`。

## 第 3 步：Stripe 收款

先全部在 **测试模式**（右上角 Test mode 开关）做，我测完再切正式。

1. 打开 dashboard.stripe.com 注册。按提示 **Activate payments**：
   - 国家选加拿大；
   - 填个人或公司信息、身份验证、收款的银行账户。
2. **Product catalog** → **Add product**：
   - 名称 `PlotCloud Monthly`
   - Pricing：**Recurring**，**Monthly**，**CAD 16.99**
   - 保存后，复制价格的 ID（`price_` 开头）发给我。
3. **Settings → Billing → Customer portal**：
   - 打开 “Cancel subscriptions”（选 “At end of billing period”）、“Update payment methods” 和 “Invoice history”；
   - 填写公司名称和联系邮箱。
4. **Developers → Webhooks → Add endpoint**：
   - Endpoint URL：`https://cgxszynizkbiblfiaowf.supabase.co/functions/v1/stripe-billing/webhook`
   - 选这些事件：`checkout.session.completed`、`customer.subscription.created`、`customer.subscription.updated`、
     `customer.subscription.deleted`、`invoice.paid`、`invoice.payment_failed`
   - 保存后，在这个 endpoint 页面点 **Reveal** 看 **Signing secret**（`whsec_` 开头）。
5. 把密钥填进 Supabase，不经过聊天：
   - 打开 supabase.com/dashboard → 项目 → **Edge Functions** → **Secrets** → 添加 4 项：

     | 名称 | 值 |
     |---|---|
     | `STRIPE_SECRET_KEY` | Stripe **Developers → API keys** 里的 Secret key（测试模式是 `sk_test_` 开头） |
     | `STRIPE_WEBHOOK_SECRET` | 上一步的 `whsec_…` |
     | `STRIPE_PRICE_ID` | 第 2 点的 `price_…` |
     | `SITE_URL` | `https://simusites.com/mvp/` |

## 第 4 步：注册邮件用自己的发件地址（Resend，免费）

Supabase 自带的发件服务每小时只能发几封，正式注册必须换掉。

1. 打开 resend.com 注册 → **Domains** → **Add Domain** → `simusites.com`。
2. Resend 会列出几条 DNS 记录（MX、TXT），逐条添加到 Cloudflare 的 **DNS → Records**。
   Proxy 一栏选 **DNS only**（灰色云）。回到 Resend 点 **Verify**。
3. Resend **API Keys** → **Create API Key**（权限 Sending access）。
4. Supabase → **Authentication → Emails → SMTP Settings** → 打开 Custom SMTP：

   | 项 | 值 |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | 刚才的 API key |
   | Sender email | `no-reply@simusites.com` |
   | Sender name | `PlotCloud` |

## 第 5 步：登录链接指向新域名

Supabase → **Authentication → URL Configuration**：
- **Site URL** 改为 `https://simusites.com/mvp/`
- **Redirect URLs** 添加 `https://simusites.com/mvp/**`
- 暂时保留旧的 `https://plotcloudstudio.github.io/plotcloud/mvp/`，迁移完成后再删。

## 可选：用域名邮箱收信（免费）

Cloudflare → simusites.com → **Email → Email Routing**：
- 把 `hello@simusites.com` 转发到你现在的 Gmail；
- 网站上的联系邮箱以后可以换成这个地址。

---

## 我这边会做的
- 你完成第 1、2 步后：检查 DNS 和 HTTPS 是否生效，在新域名上跑测试，把旧的 github.io 地址设成自动跳转。
- 你完成第 3 步后：部署收款服务，用 Stripe 测试卡 `4242 4242 4242 4242` 走完一次订阅、续费、取消，确认会员自动开通和到期。
- 你完成第 4、5 步后：测试注册、确认邮件、找回密码的邮件都从新地址发出，链接指向新域名。
- 最后：你确认价格页和条款文字后，切换到 Stripe 正式模式。
