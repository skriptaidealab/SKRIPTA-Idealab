// Cloudflare Worker with two cron triggers. Calls the Pages functions that send the morning link and the end-of-slot reminders.
// Variables: SITE_URL (e.g. https://skripta-1k7.pages.dev), secret CRON_SECRET (same value as in the Pages project).
export default {
  async scheduled(event, env) {
    const path = event.cron === '0 6 * * 1-6' ? '/api/jutro' : '/api/kraj';
    const r = await fetch(env.SITE_URL + path, { method: 'POST', headers: { 'x-cron-secret': env.CRON_SECRET } });
    console.log(path, r.status, await r.text());
  }
};
