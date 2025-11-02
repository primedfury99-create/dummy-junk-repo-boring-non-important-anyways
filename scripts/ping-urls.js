// ping-urls.js

const URLS_FROM_ENV = [process.env.API_URL_1, process.env.API_URL_2].filter(Boolean);
const URLs = URLS_FROM_ENV.length ? URLS_FROM_ENV : [
];

// Requires Node 18+ (global fetch + AbortController)


const TIMEOUT_MS = 10_000; // 10s per request
const RETRIES = 2;         // total attempts = 1 + RETRIES
const INTERVAL_MS = 60_000; // 1 minute

async function postJsonWithTimeout(url, body = {}) {
  for (let attempt = 1; attempt <= 1 + RETRIES; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(id);

      const text = await resp.text().catch(() => '');
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText} — body: ${text}`);
      }

      return { success: true, status: resp.status, body: text };
    } catch (err) {
      clearTimeout(id);
      console.error(`[${new Date().toISOString()}] Attempt ${attempt} to POST ${url} failed:`, err.message || err);
      if (attempt === 1 + RETRIES) return { success: false, error: String(err) };
      // small backoff before retry
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

async function tick() {
  console.log(`[${new Date().toISOString()}] Starting tick — calling ${URLs.length} endpoints`);
  await Promise.all(URLs.map(async (url) => {
    const result = await postJsonWithTimeout(url, {}); // change body if needed
    if (result.success) {
      console.log(`[${new Date().toISOString()}] OK ${url} → ${result.status}`);
    } else {
      console.error(`[${new Date().toISOString()}] FAILED ${url} → ${result.error}`);
    }
  }));
}

// run immediately, then every minute
tick();
const handle = setInterval(tick, INTERVAL_MS);

// optional: handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  clearInterval(handle);
  process.exit(0);
});
