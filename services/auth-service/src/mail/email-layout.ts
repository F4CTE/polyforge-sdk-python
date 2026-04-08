const FRONTEND = process.env.FRONTEND_URL ?? 'http://localhost';

/** Wraps content in the Polyforge branded email shell. */
export function emailLayout(opts: {
  preheader?: string;
  body: string;
  footerNote?: string;
}): string {
  const preheader = opts.preheader ?? '';
  const footerNote =
    opts.footerNote ??
    `You received this email because an action was taken on your Polyforge account.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Polyforge</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    body{margin:0;padding:0;background:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif}
    table{border-collapse:collapse}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
    a{color:#06b6d4}
    .btn-primary{background:#06b6d4!important;border-radius:8px!important;color:#000!important;
      display:inline-block;font-size:15px;font-weight:600;padding:12px 28px;
      text-decoration:none!important;-webkit-text-size-adjust:none}
  </style>
</head>
<body>
  <!-- Preheader (hidden preview text) -->
  <span style="display:none;font-size:1px;color:#f4f4f7;max-height:0;max-width:0;opacity:0;overflow:hidden">
    ${preheader}
  </span>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f4f4f7">
    <tr>
      <td align="center" style="padding:32px 16px 0">

        <!-- Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0"
               style="max-width:560px;background:#ffffff;border-radius:12px;
                      box-shadow:0 2px 16px rgba(0,0,0,0.06);overflow:hidden">

          <!-- Header bar -->
          <tr>
            <td bgcolor="#0a0a0f" align="center" style="padding:24px 32px">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle">
                    <!-- Bolt SVG icon -->
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                         xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stop-color="#67e8f9"/>
                          <stop offset="100%" stop-color="#06b6d4"/>
                        </linearGradient>
                      </defs>
                      <path d="M13 2L4.09 12.96H11L10 22L20.91 11.04H14L13 2Z"
                            fill="url(#bg)"/>
                    </svg>
                  </td>
                  <td style="vertical-align:middle">
                    <span style="font-size:22px;font-weight:700;color:#f0f0f5;
                                 font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                                 letter-spacing:-0.5px">Polyforge</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 32px;color:#1f2937;
                       font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                       font-size:15px;line-height:1.7">
              ${opts.body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#f9fafb" style="padding:20px 40px;
                                         border-top:1px solid #e5e7eb;
                                         font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                                         font-size:12px;color:#9ca3af;line-height:1.6">
              <p style="margin:0 0 6px">${footerNote}</p>
              <p style="margin:0">
                <a href="${FRONTEND}/settings" style="color:#06b6d4;text-decoration:none">Notification preferences</a>
                &nbsp;&middot;&nbsp;
                <a href="${FRONTEND}/terms" style="color:#9ca3af;text-decoration:none">Terms</a>
                &nbsp;&middot;&nbsp;
                <a href="${FRONTEND}/privacy" style="color:#9ca3af;text-decoration:none">Privacy</a>
              </p>
            </td>
          </tr>

        </table>

        <!-- Below-card note -->
        <p style="font-size:12px;color:#9ca3af;margin:16px 0 32px;text-align:center">
          &copy; ${new Date().getFullYear()} Polyforge. All rights reserved.
        </p>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
