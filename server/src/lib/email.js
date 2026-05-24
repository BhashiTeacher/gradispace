const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.EMAIL_FROM || 'GradiSpace <noreply@gradispace.com>';

// ── Shared styles ─────────────────────────────────────────────────────────────
const BLUE  = '#2B3FE8';
const NAVY  = '#1A1A8E';
const LIGHT = '#F0F4FF';

function wrap(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,Arial,sans-serif;color:#1E293B">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

        <!-- Logo -->
        <tr><td style="padding-bottom:28px;text-align:center">
          <span style="font-size:22px;font-weight:900;color:${BLUE}">Gradi</span><span style="font-size:22px;font-weight:900;color:${NAVY}">Space</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:white;border-radius:16px;padding:36px 36px 32px;border:1px solid #E2E8F0">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:20px;text-align:center;font-size:12px;color:#94A3B8">
          © ${new Date().getFullYear()} GradiSpace · If you didn't request this email, you can safely ignore it.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Password reset ─────────────────────────────────────────────────────────────
async function sendPasswordReset(toEmail, resetUrl) {
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0F172A">Reset your password</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6">
      We received a request to reset the password for your GradiSpace account
      (<strong>${toEmail}</strong>). Click the button below to choose a new one.
    </p>
    <p style="margin:0 0 24px;text-align:center">
      <a href="${resetUrl}"
        style="display:inline-block;background:${BLUE};color:white;font-size:15px;font-weight:700;
               text-decoration:none;padding:14px 36px;border-radius:10px">
        Reset my password
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#94A3B8">
      This link expires in <strong>1 hour</strong>. If you didn't request a password reset,
      no action is needed — your account remains secure.
    </p>
    <hr style="border:none;border-top:1px solid #F1F5F9;margin:20px 0">
    <p style="margin:0;font-size:12px;color:#CBD5E1">
      Can't click the button? Paste this into your browser:<br>
      <span style="color:${BLUE};word-break:break-all">${resetUrl}</span>
    </p>
  `;

  const { error } = await resend.emails.send({
    from:    FROM,
    to:      [toEmail],
    subject: 'Reset your GradiSpace password',
    html:    wrap(body),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── Welcome email ─────────────────────────────────────────────────────────────
async function sendWelcome(name, toEmail) {
  const dashboardUrl = `${process.env.CLIENT_URL}/dashboard`;
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0F172A">Welcome to GradiSpace, ${name.split(' ')[0]}! 🎉</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6">
      Your account is ready. You can now create exams, build a question bank,
      and share results with your students — all in one place.
    </p>
    <div style="background:${LIGHT};border-radius:12px;padding:20px 24px;margin:0 0 24px">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1E293B;text-transform:uppercase;letter-spacing:.05em">Get started in 3 steps</p>
      <p style="margin:0 0 6px;font-size:14px;color:#475569">✦ &nbsp;Create your first exam (try the AI builder)</p>
      <p style="margin:0 0 6px;font-size:14px;color:#475569">✦ &nbsp;Share the link with your students</p>
      <p style="margin:0;font-size:14px;color:#475569">✦ &nbsp;Watch results come in live</p>
    </div>
    <p style="margin:0 0 24px;text-align:center">
      <a href="${dashboardUrl}"
        style="display:inline-block;background:${BLUE};color:white;font-size:15px;font-weight:700;
               text-decoration:none;padding:14px 36px;border-radius:10px">
        Go to my dashboard
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#94A3B8">
      Questions? Reply to this email — a real person will get back to you.
    </p>
  `;

  const { error } = await resend.emails.send({
    from:    FROM,
    to:      [toEmail],
    subject: `Welcome to GradiSpace, ${name.split(' ')[0]}!`,
    html:    wrap(body),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

module.exports = { sendPasswordReset, sendWelcome };
