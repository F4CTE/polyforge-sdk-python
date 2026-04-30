/* eslint-disable */
/* Contact page — team email cards + chat channels */

(() => {
  const CARDS = [
    {
      icon: 'message',
      title: 'General inquiries',
      desc: 'Questions about the product, billing, or partnerships. We reply within 1 business day.',
      addr: 'hello@polyforge.app',
      meta: ['London · eu-west-2', 'Mon–Fri'],
    },
    {
      icon: 'code',
      title: 'Technical support',
      desc: 'SDK bugs, API issues, strategy help. Include your user ID and a repro if possible.',
      addr: 'support@polyforge.app',
      meta: ['24/7 on-call', 'Critical issues paged'],
    },
    {
      icon: 'shield',
      title: 'Security & disclosures',
      desc: 'Vulnerability reports, PGP-signed preferred. We run a paid bug bounty — see security.txt.',
      addr: 'security@polyforge.app',
      meta: ['PGP: 0xA4F2...B8', 'Bounty: $500–$50k'],
    },
    {
      icon: 'briefcase',
      title: 'Media & press',
      desc: 'Interview requests, press kit, quote verification. We do not comment on user trading activity.',
      addr: 'press@polyforge.app',
      meta: ['Press kit available', '~48h turnaround'],
    },
    {
      icon: 'briefcase',
      title: 'Careers',
      desc: 'Open roles and general applications. Strong track record > credentials. We read every one.',
      addr: 'jobs@polyforge.app',
      meta: ['12 roles open', 'Remote-friendly'],
    },
    {
      icon: 'file-text',
      title: 'Legal & compliance',
      desc: 'Subpoenas, regulatory inquiries, data-access requests under GDPR / CCPA / UK DPA.',
      addr: 'legal@polyforge.app',
      meta: ['Formal notices only', 'London jurisdiction'],
    },
  ];

  const CHANNELS = [
    { initial: 'D', name: 'Discord',  handle: 'discord.gg/polyforge', href: '#' },
    { initial: 'T', name: 'Telegram', handle: '@polyforge_community', href: '#' },
    { initial: 'X', name: 'X / Twitter', handle: '@polyforgehq', href: '#' },
    { initial: 'G', name: 'GitHub',   handle: 'github.com/polyforge', href: '#' },
  ];

  function App() {
    return (
      <CompanyPage active="contact">
        <CompanyPageHeader
          eyebrow="Contact"
          title="Reach the right team, faster."
          lede="Pick the channel that fits your question. We deliberately don’t have a generic contact form — going direct gets you a better answer, sooner."
          meta={[
            { label: 'Response time', value: '< 1 business day' },
            { label: 'Coverage', value: 'EN / FR / ES · 24/7 support on-call' },
            { label: 'HQ', value: 'London · 38.9°N 77.0°W backup' },
          ]}
        />

        <CompanySection title="By team">
          <div className="contact-grid">
            {CARDS.map((c) => (
              <a key={c.addr} className="contact-card" href={`mailto:${c.addr}`}>
                <div className="contact-card-icon"><Icon name={c.icon} size={16} /></div>
                <div className="contact-card-title">{c.title}</div>
                <div className="contact-card-desc">{c.desc}</div>
                <div className="contact-card-addr">
                  {c.addr}
                  <Icon name="arrow-up-right" size={12} />
                </div>
                <div className="contact-card-meta">
                  {c.meta.map((m, i) => <span key={i}>{m}</span>)}
                </div>
              </a>
            ))}
          </div>
        </CompanySection>

        <CompanySection title="Community" subtitle="The fastest way to get answers from people who have already hit your issue.">
          <div className="contact-channels">
            {CHANNELS.map((c) => (
              <a key={c.name} className="contact-channel" href={c.href}>
                <div className="contact-channel-icon">{c.initial}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="contact-channel-name">{c.name}</div>
                  <div className="contact-channel-handle">{c.handle}</div>
                </div>
              </a>
            ))}
          </div>
        </CompanySection>

        <CompanySection title="Office hours">
          <div className="contact-inline">
            <div>
              <div className="contact-inline-title">Weekly AMA</div>
              <div className="contact-inline-body">
                Every Thursday at 16:00 UTC we host a 45-minute live call. Ask anything — product
                roadmap, strategy design, market structure. Recordings posted to YouTube within 24h.
                <div style={{ marginTop: 12 }}>
                  <a href="#">Add to calendar →</a>
                </div>
              </div>
            </div>
            <div>
              <div className="contact-inline-title">Office visits</div>
              <div className="contact-inline-body">
                London office open to customers by appointment. We’ll buy the coffee. No walk-ins — the
                building has a security desk that will politely refuse.
                <div style={{ marginTop: 12, fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Polyforge Ltd · 8 Bricklayers Court · London EC2A 3LU · UK
                </div>
              </div>
            </div>
          </div>
        </CompanySection>

        <CompanySection>
          <div style={{
            padding: 24, borderRadius: 12,
            background: 'var(--warning-subtle)',
            border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
            display: 'flex', gap: 16, alignItems: 'flex-start',
          }}>
            <div style={{ width: 36, height: 36, flex: '0 0 auto', borderRadius: 8, background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', display: 'grid', placeItems: 'center', color: 'var(--warning)' }}>
              <Icon name="alert" size={16} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                We don’t give trading advice.
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                If you’re asking us "should I buy this market?" — we can’t answer. Polyforge is software,
                not a broker or adviser. See our <a href="Risk Disclosure.html" style={{ color: 'var(--accent-text)', textDecoration: 'none' }}>Risk Disclosure</a> for details.
              </div>
            </div>
          </div>
        </CompanySection>
      </CompanyPage>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
