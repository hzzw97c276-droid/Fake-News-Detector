/**
 * mlPredict.js
 * Node.js client for the local Python ML prediction service.
 * Non-blocking — if the ML service is down, returns null (graceful degradation).
 */

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8002';
const TIMEOUT_MS = 3000; // give up after 3s so we don't block the main API

/**
 * Ask the local ML model for a quick first-pass verdict on the claim.
 *
 * Returns:
 *   { verdict, confidence, probabilities, method, model_loaded }
 *   OR null if the service is unavailable / model not trained yet
 */
export async function mlPredict(claim) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${ML_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Service not running or model not trained — fail silently
    return null;
  }
}

/**
 * Check if the ML service is alive.
 */
export async function mlHealthCheck() {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${ML_URL}/health`, { signal: controller.signal });
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false, model_loaded: false };
  }
}
