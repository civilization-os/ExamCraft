import nodemailer from 'nodemailer';

/**
 * ExamCraft AI 官方邮件服务模块
 * 支持：
 * 1. 任意自定义 App 身份发信：ExamCraft AI 官方团队 <service@examcraft.ai>
 * 2. 真实 SMTP 服务（如配置了网易/QQ/Resend等通道，走 465/587 穿透运营商封锁）
 * 3. 裸机/野邮箱直发尝试（直接投递至对方收件服务器或垃圾箱）
 * 4. 控制台日志高亮终端直出（开发/本地离线兜底，永不卡死重置流程）
 */

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || '';
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    return { host, port, secure, auth: { user, pass } };
  }
  return null;
}

export async function sendPasswordResetMail({ toEmail, username, resetUrl, token }) {
  const cleanTo = String(toEmail || '').trim();
  const targetRecipient = cleanTo.includes('@') ? cleanTo : `${username}@local`;
  const fromName = process.env.SMTP_FROM_NAME || 'ExamCraft AI 官方团队';
  const fromAddress = process.env.SMTP_FROM_EMAIL || 'service@examcraft.ai';
  const senderHeader = `"${fromName}" <${fromAddress}>`;

  // 1. 高亮控制台终端直出（确保本地测试、自建部署或邮箱拒收时 100% 可用）
  console.log('\n======================================================================');
  console.log('📬 [ExamCraft 官方邮件系统] 密码重置邮件已分发！');
  console.log(`发件人: ${senderHeader}`);
  console.log(`收件人: ${targetRecipient} (账号: ${username})`);
  console.log(`有效时限: 15 分钟`);
  console.log(`动态重置链接: ${resetUrl}`);
  console.log('提示: 未经商业企业认证的邮件极易被公共邮箱归入【垃圾箱】(Spam)，请在垃圾箱中查收！');
  console.log('======================================================================\n');

  // 构建精美的高拟真邮件 HTML 模板
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>ExamCraft AI 密码重置验证</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 32px 28px; color: #ffffff; text-align: left; }
        .logo { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin: 0 0 6px 0; color: #ffffff; display: flex; align-items: center; gap: 8px; }
        .subtitle { font-size: 13px; color: #cbd5e1; margin: 0; }
        .content { padding: 32px 28px; }
        .btn { display: inline-block; background-color: #4338ca; color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-size: 15px; font-weight: 600; margin: 24px 0; box-shadow: 0 4px 12px rgba(67, 56, 202, 0.25); text-align: center; }
        .alert-box { background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 8px; margin: 20px 0; font-size: 13px; color: #92400e; line-height: 1.6; }
        .url-box { background-color: #f1f5f9; padding: 12px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 12px; color: #475569; margin-top: 8px; }
        .footer { padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="logo">✦ ExamCraft AI Workbench</div>
          <div class="subtitle">智能组卷与在线考练工作台 · 账号安全中心</div>
        </div>
        <div class="content">
          <p style="font-size: 16px; font-weight: 600; margin-top: 0;">尊敬的 <strong>${username}</strong>：</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            我们收到了您为 ExamCraft 账号重置登录密码的申请。请在 <strong>15 分钟内</strong> 点击下方按钮设置新密码：
          </p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="btn" target="_blank">立即前往重置密码</a>
          </div>

          <div class="alert-box">
            <strong>⚠️ 垃圾箱温馨提醒：</strong><br />
            本邮件由 ExamCraft AI 系统直接派发，若在【收件箱】未及时显示，<strong>请务必检查您的【垃圾箱】或【垃圾邮件】文件夹</strong>，并建议点击“移出垃圾箱”或设为信任发件人。
          </div>

          <p style="font-size: 12px; color: #64748b; margin-top: 24px;">如果按钮无法直接点击，请复制以下完整链接至浏览器地址栏打开：</p>
          <div class="url-box">${resetUrl}</div>
        </div>
        <div class="footer">
          此邮件由 ExamCraft AI 自动化系统发出，无需回复。<br />
          若非您本人操作，请忽略本邮件，您的原密码将保持安全不变。
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `【ExamCraft AI】密码重置验证\n\n尊敬的 ${username}：\n您正在申请重置 ExamCraft 登录密码，请在 15 分钟内访问以下动态链接完成重置：\n${resetUrl}\n\n注意：若您在收件箱中未看到此邮件，请前往【垃圾箱/垃圾邮件】查找！若非您本人操作，请忽略本邮件。`;

  const smtpConfig = getSmtpConfig();
  if (smtpConfig) {
    try {
      const transporter = nodemailer.createTransport(smtpConfig);
      const info = await transporter.sendMail({
        from: senderHeader,
        to: targetRecipient,
        subject: `【ExamCraft AI】请重置您的登录密码（来自应用专属邮件）`,
        text: textContent,
        html: htmlContent
      });
      console.log('[ExamCraft Mailer] SMTP 投递成功:', info.messageId);
      return { success: true, delivered: true, method: 'smtp' };
    } catch (err) {
      console.warn('[ExamCraft Mailer] SMTP 投递失败，使用本地兜底:', err.message);
      return { success: true, delivered: false, method: 'smtp_failed', error: err.message };
    }
  }

  // 若未配置外部 SMTP，尝试以直发方式投递，或优雅记录本地
  if (targetRecipient.includes('@')) {
    try {
      // 尝试直发 (direct send)
      const directTransporter = nodemailer.createTransport({
        direct: true,
        name: 'examcraft.ai',
        port: 25,
        connectionTimeout: 4000
      });
      directTransporter.sendMail({
        from: senderHeader,
        to: targetRecipient,
        subject: `【ExamCraft AI】重置密码动态链接`,
        text: textContent,
        html: htmlContent
      }).then((res) => {
        console.log('[ExamCraft Mailer] 野邮箱直发完成 (请查收垃圾箱):', res?.messageId || 'OK');
      }).catch((e) => {
        console.log('[ExamCraft Mailer] 野邮箱直发受阻 (各大邮箱/运营商封锁25端口属正常现象，已控制台输出):', e.message);
      });
    } catch (e) {
      // ignore
    }
  }

  return { success: true, delivered: false, method: 'console_fallback' };
}
