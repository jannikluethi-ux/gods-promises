/**
 * Morning promise email. Markup follows supabase/templates/confirm-signup.html:
 * cloud blue field, wordmark, slate #3d5470, italic serif verse, pill button.
 */
"use strict";

const ORIGIN = "https://hispromisedaily.com";
const WORDMARK = ORIGIN + "/email/hpd-wordmark.png";

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function greetingName(name) {
  return String(name || "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 80);
}

function oneLine(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function renderDailyEmail(input) {
  const name = greetingName(input.displayName);
  const reference = oneLine(input.reference);
  const text = oneLine(input.text);
  const explanation = oneLine(input.explanation);
  const verseUrl = String(input.verseUrl || ORIGIN + "/");
  const unsubscribeUrl = String(input.unsubscribeUrl || ORIGIN + "/");
  const greeting = name ? "Good morning, " + escapeHtml(name) + "." : "Good morning.";
  const preview = text.length > 90 ? text.slice(0, 87).trim() + "…" : text;
  const subject = "Today’s promise — " + (reference || "His Promise Daily");

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(subject)}</title>
  <style type="text/css">
    html, body { margin:0 !important; padding:0 !important; height:100% !important; width:100% !important; }
    * { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; }
    table { border-spacing:0 !important; border-collapse:collapse !important; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    a { text-decoration:underline; }
    @media screen and (max-width:620px) {
      .email-shell { width:100% !important; max-width:100% !important; }
      .email-pad { padding-left:24px !important; padding-right:24px !important; }
      .wordmark { width:280px !important; height:auto !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#e1e9f1;width:100%;" bgcolor="#e1e9f1">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(preview)}
  </div>
  <div role="article" aria-roledescription="email" aria-label="${escapeHtml(subject)}" lang="en" style="background-color:#e1e9f1;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;background-color:#e1e9f1;" bgcolor="#e1e9f1">
      <tr>
        <td align="center" valign="top" style="padding:24px 12px 32px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-shell" style="width:100%;max-width:600px;margin:0 auto;background-color:#fbfcfd;border:1px solid #d5dfe9;border-radius:16px;">
            <tr>
              <td align="center" valign="middle" bgcolor="#e9eff5" class="email-pad" style="background-color:#e9eff5;padding:32px 32px 28px;border-bottom:1px solid #d5dfe9;">
                <a href="${escapeHtml(ORIGIN)}" target="_blank" style="text-decoration:none;border:0;">
                  <img src="${WORDMARK}" alt="His Promise Daily" width="360" height="96" class="wordmark" style="display:block;margin:0 auto;border:0;width:360px;height:96px;max-width:100%;font-family:Georgia,'Times New Roman',Times,serif;font-size:28px;line-height:1.2;color:#1a2230;" />
                </a>
              </td>
            </tr>
            <tr>
              <td align="left" valign="top" bgcolor="#fbfcfd" class="email-pad" style="background-color:#fbfcfd;padding:36px 40px 8px;">
                <h1 style="margin:0 0 16px;padding:0;font-family:Georgia,'Times New Roman',Times,serif;font-size:26px;font-weight:400;line-height:1.3;color:#1a2230;">
                  ${greeting}
                </h1>
                <p style="margin:0 0 8px;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#3b4556;">
                  Here is today’s promise from Scripture.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;">
                  <tr>
                    <td style="padding:18px 0 18px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="font-size:0;line-height:0;border-bottom:1px solid #3d5470;width:32px;">&nbsp;</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-family:Georgia,'Times New Roman',Times,serif;font-size:18px;font-style:italic;font-weight:400;line-height:1.55;color:#1a2230;padding:0 0 8px;">
                      ${escapeHtml(text)}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-style:normal;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;line-height:1.4;color:#3d5470;padding:0 0 16px;">
                      ${escapeHtml(reference)} (WEB)
                    </td>
                  </tr>
                  <tr>
                    <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#3b4556;padding:0 0 8px;">
                      ${escapeHtml(explanation)}
                    </td>
                  </tr>
                </table>
                <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
                  <tr>
                    <td align="center">
                      <a href="${escapeHtml(verseUrl)}" target="_blank" style="display:inline-block;background-color:#3d5470;border:1px solid #3d5470;border-radius:999px;color:#fbfcfd;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;line-height:16px;letter-spacing:0.02em;padding:16px 28px;text-align:center;text-decoration:none;">
                        Read today’s promise
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="left" valign="top" bgcolor="#fbfcfd" class="email-pad" style="background-color:#fbfcfd;padding:8px 40px 28px;">
                <p style="margin:16px 0 0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#4d5868;">
                  If the button doesn’t work, copy this link into your browser:<br>
                  <a href="${escapeHtml(verseUrl)}" target="_blank" style="color:#3d5470;text-decoration:underline;">${escapeHtml(verseUrl)}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" valign="top" bgcolor="#e4ecf3" class="email-pad" style="background-color:#e4ecf3;padding:24px 32px 28px;border-top:1px solid #d5dfe9;">
                <p style="margin:0 0 8px;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#4d5868;">
                  <a href="${escapeHtml(ORIGIN)}" target="_blank" style="color:#3d5470;text-decoration:underline;">hispromisedaily.com</a>
                </p>
                <p style="margin:0 0 10px;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:#4d5868;">
                  His Promise Daily · Jannik Luethi
                </p>
                <p style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:#4d5868;">
                  <a href="${escapeHtml(unsubscribeUrl)}" target="_blank" style="color:#3d5470;text-decoration:underline;">Unsubscribe from the morning promise</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  const plain = [
    name ? "Good morning, " + name + "." : "Good morning.",
    "",
    "Here is today’s promise from Scripture.",
    "",
    text,
    "",
    reference ? reference + " (WEB)" : "World English Bible",
    "",
    explanation,
    "",
    "Read today’s promise: " + verseUrl,
    "",
    "Unsubscribe from the morning promise: " + unsubscribeUrl,
    "",
    "His Promise Daily · Jannik Luethi",
    "hispromisedaily.com",
  ].join("\n");

  return { subject: subject.replace(/[\r\n]/g, " ").slice(0, 180), html: html, text: plain };
}

module.exports = { renderDailyEmail, greetingName, ORIGIN, WORDMARK };
