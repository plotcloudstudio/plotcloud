# simusites.com 上线设置（需要你本人在各网站上点的步骤）

按顺序做。每做完一步告诉我，我会检查是否生效，再接着做代码和测试。
**任何密钥（以 `sk_`、`whsec_`、`re_` 开头的）都不要发在聊天里**：直接填进下面写明的网站设置里。
`price_` 开头的价格 ID 不是密钥，可以发给我。

---

## 已完成（2026-11-21）

- **第 1 步 域名交给 Cloudflare**：simusites.com 的 nameserver 已指向 Cloudflare。
- **第 2 步 网站托管**：Cloudflare Pages 连接 GitHub 一直失败，改为沿用 GitHub Pages（main 分支根目录，合并即自动更新）。
  - Cloudflare DNS：`simusites.com` 4 条 A 记录指向 `185.199.108.153`、`.109`、`.110`、`.111`；`www` CNAME 指向 `plotcloudstudio.github.io`；全部 **DNS only**（灰色云）。
  - GitHub 仓库 Settings → Pages：Custom domain 为 `simusites.com`，已打开 Enforce HTTPS（GitHub 自动在 main 加了 `CNAME` 文件）。
  - 网站地址 `https://simusites.com/mvp/`；旧的 github.io 地址自动跳转到新域名。
- **第 5 步 登录链接**：Supabase Site URL 已改为 `https://simusites.com/mvp/`，Redirect URLs 已加 `https://simusites.com/mvp/` 和 `https://simusites.com/mvp/**`，旧地址的两条暂时保留。

## 第 3 步：Stripe 收款

先全部在 **测试模式**（右上角 Test mode 开关）做，我测完再切正式。

1. 打开 dashboard.stripe.com 注册。按提示 **Activate payments**：
   - 国家选加拿大；
   - 填个人或公司信息、身份验证、收款的银行账户。
2. **Product catalog** → **Add product**：
   - 名称 `SimuSite Monthly`
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
   | Sender name | `SimuSite` |

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
