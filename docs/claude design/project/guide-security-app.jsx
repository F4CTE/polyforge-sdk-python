/* Guide — Security & 2FA */
const TOC = [
  { id: 'password', text: 'Your password', level: 2 },
  { id: '2fa', text: 'Two-factor auth (2FA)', level: 2 },
  { id: 'api-keys', text: 'API keys', level: 2 },
  { id: 'devices', text: 'Devices & sessions', level: 2 },
  { id: 'wallet', text: 'Your Polymarket wallet', level: 2 },
  { id: 'phishing', text: 'Phishing & scams', level: 2 },
  { id: 'what-we-store', text: 'What Polyforge stores (and doesn\'t)', level: 2 },
];

function Page() {
  return (
    <DocsLayout
      variant="guide"
      section="guide"
      activeId="security"
      toc={TOC}
      breadcrumbs={[{ label: 'Guide', href: 'Guide.html' }, { label: 'Your account' }, { label: 'Security & 2FA' }]}
      prev={{ title: 'Account & billing', href: 'Guide-Account-Billing.html' }}
      next={{ title: 'Glossary', href: 'Guide-Glossary.html' }}
    >
      <h1>Security & 2FA</h1>
      <p className="docs-lede">Trading accounts get attacked. Not "might" — will. This page covers every security feature Polyforge offers and the two or three habits that actually matter.</p>

      <h2 id="password">Your password</h2>
      <p>Use a unique password for Polyforge that you use nowhere else. A password manager is the only sensible way to do this — any of 1Password, Bitwarden, or Apple Passwords is fine. If you're still reusing "correcthorsebattery2019" across sites, please change it today.</p>

      <h2 id="2fa">Two-factor auth (2FA)</h2>
      <p>Enable 2FA the moment you sign up. Settings → Security → Two-factor auth. We support:</p>
      <ul>
        <li><strong>Authenticator app</strong> (Google Auth, 1Password, Authy) — recommended</li>
        <li><strong>Hardware keys</strong> (YubiKey, Titan) — most secure</li>
        <li><strong>Passkey</strong> — increasingly the best option if your devices support it</li>
      </ul>
      <Callout type="warn" title="SMS 2FA is not enough">We don't offer SMS 2FA on purpose. SIM-swap attacks are too common in crypto-adjacent accounts. If you only want to do one security thing this year, turn on app-based 2FA.</Callout>

      <h2 id="api-keys">API keys</h2>
      <p>If you use the SDK, REST API, or MCP server, you need an API key. Settings → API keys → Create. A few rules:</p>
      <ul>
        <li><strong>Scope every key.</strong> Read-only keys can't place orders. Paper-only keys can't touch real money. Use the narrowest scope that works.</li>
        <li><strong>Expire keys regularly.</strong> Default is 90 days. Rotate them — old keys in old git history is how people get breached.</li>
        <li><strong>Never commit keys.</strong> Even to a private repo. Use environment variables or a secrets manager.</li>
        <li><strong>Revoke fast.</strong> If a key might be leaked, revoke it. Create a new one. It takes 15 seconds.</li>
      </ul>

      <h2 id="devices">Devices & sessions</h2>
      <p>Settings → Security → Sessions lists every device logged into your account. Sign out any you don't recognize. Every session carries a fingerprint — OS, browser, approximate location — so you can tell "my laptop" from "some VM in a country I've never been to".</p>

      <h2 id="wallet">Your Polymarket wallet</h2>
      <p>Remember: Polyforge doesn't hold your trading capital. Your USDC lives in your Polymarket wallet. The security of that wallet is governed by Polymarket, not us.</p>
      <p>Two things to do there:</p>
      <ol>
        <li>Back up your wallet recovery phrase. Write it down. Store it somewhere that is neither a photo on your phone nor a Google Doc titled "wallet.txt".</li>
        <li>Enable every security feature Polymarket offers — 2FA on the login, spend limits, etc.</li>
      </ol>

      <h2 id="phishing">Phishing & scams</h2>
      <p>Prediction-market adjacent communities attract scammers. A few rules that will save you:</p>
      <ul>
        <li><strong>We will never DM you.</strong> Polyforge support operates over email and our in-app chat. If someone on Discord claims to be "support", they aren't.</li>
        <li><strong>We will never ask for your password or recovery phrase.</strong> Not by email, not by phone, not in chat. Anyone who does is trying to rob you.</li>
        <li><strong>Check URLs.</strong> Real Polyforge is <code>polyforge.app</code>. Not <code>polyforge.io</code>, not <code>polyfоrge.app</code> (that 'o' is Cyrillic).</li>
      </ul>

      <h2 id="what-we-store">What Polyforge stores (and doesn't)</h2>
      <p>We store your strategies, your trade logs, your account settings, and enough of your identity to bill you. We don't store your Polymarket private keys — we never see them. We don't store anything we can't operationally justify. Full detail in the <a href="Privacy.html">Privacy Policy</a>.</p>
    </DocsLayout>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Page />);
