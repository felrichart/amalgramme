/*
 * Transactional emails (verification, password reset) through Resend's HTTP API
 * (https://resend.com/docs/api-reference/emails/send-email); the key is the
 * RESEND_API_KEY secret. In dev (MAIL_MODE=log in server/.dev.vars) nothing is
 * sent: the link is logged and handed back to the caller so the flows stay
 * testable end to end. Only that explicit flag exposes links — a prod Worker
 * missing its key fails the send instead of leaking reset links.
 */
const TEMPLATES = {
  verify: {
    path: '/verifier',
    subject: 'Confirme ton adresse email',
    lead: (name) => `Bonjour ${name}, confirme ton adresse pour sécuriser ton compte Amalgramme.`,
    cta: 'Confirmer mon adresse',
    note: 'Ce lien est valable 48 heures.',
  },
  reset: {
    path: '/mot-de-passe',
    subject: 'Réinitialise ton mot de passe',
    lead: (name) => `Bonjour ${name}, tu as demandé à changer ton mot de passe Amalgramme.`,
    cta: 'Choisir un nouveau mot de passe',
    note: 'Ce lien est valable 1 heure. Si tu n’as rien demandé, ignore ce message.',
  },
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const mailLogged = (env) => env.MAIL_MODE === 'log';

/* Resolves to the link when it was logged rather than sent. */
export async function sendAccountMail(env, kind, { to, username, token }) {
  const t = TEMPLATES[kind];
  const link = `${env.APP_URL}${t.path}?token=${encodeURIComponent(token)}`;
  if (mailLogged(env)) {
    console.log(`[mail:${kind}] ${to} → ${link}`);
    return link;
  }
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  const lead = t.lead(username);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: `Amalgramme <${env.MAIL_FROM}>`,
      to: [to],
      subject: t.subject,
      text: `${lead}\n\n${t.cta} : ${link}\n\n${t.note}`,
      html: `<p>${escapeHtml(lead)}</p>
<p><a href="${escapeHtml(link)}">${escapeHtml(t.cta)}</a></p>
<p style="color:#777;font-size:13px">${escapeHtml(t.note)}</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
