import { Router } from 'express';
import { searchEvidence } from '../services/webSearch.js';
import { analyzeClaim } from '../services/aiAnalysis.js';
import { cacheGet, cacheSet, cachePrune } from '../services/cache.js';
import { mlPredict } from '../services/mlPredict.js';

const router = Router();
const MIN_LEN = 10;
const MAX_LEN = 3000;

// Prune expired cache entries every hour
setInterval(cachePrune, 60 * 60 * 1000);

router.post('/', async (req, res) => {
  // ── Input Validation ────────────────────────────────────────────────────────
  const raw = req.body?.claim;
  if (typeof raw !== 'string') {
    return res.status(400).json({ error: 'Request body must include a "claim" string field.' });
  }
  const claim = raw.trim();
  if (claim.length < MIN_LEN) {
    return res.status(400).json({ error: `Please enter at least ${MIN_LEN} characters.` });
  }
  if (claim.length > MAX_LEN) {
    return res.status(400).json({ error: `Please keep the claim under ${MAX_LEN} characters.` });
  }

  // ── Prompt-injection guard: strip control characters ────────────────────────
  const safeClaim = claim.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');

  // ── Cache Lookup ────────────────────────────────────────────────────────────
  const cached = cacheGet(safeClaim);
  if (cached) {
    return res.json({ ...cached, fromCache: true });
  }

  try {
    // ── Step 1: ML First-Pass (local, non-blocking) ───────────────────────────
    // Runs in parallel with the search — contributes ML signal to final response
    const mlPromise = mlPredict(safeClaim);

    // ── Step 2: Web Search ────────────────────────────────────────────────────
    const results = await searchEvidence(safeClaim);

    // Await ML result (usually done by now — it's very fast)
    const mlResult = await mlPromise;

    if (results.length === 0) {
      const response = {
        claim: safeClaim,
        verdict: 'UNVERIFIED',
        explanation:
          'No relevant search results were found for this claim. This does not mean the claim is false — it may be very new, hyper-local, or phrased in a way that did not match available sources.',
        supportingEvidence: [],
        contradictingEvidence: [],
        confidence: 0,
        confidenceExplanation:
          'No evidence was retrieved. Viral claims completely absent from credible search results often have a high probability of being fabricated — but this system cannot confirm that without evidence.',
        sources: [],
        retrievedCount: 0,
        model: null,
        mlAnalysis: mlResult || null,
        searchedAt: new Date().toISOString(),
        fromCache: false,
      };
      cacheSet(safeClaim, response);
      return res.json(response);
    }

    // ── Step 3: AI Deep Analysis ──────────────────────────────────────────────
    const analysis = await analyzeClaim(safeClaim, results);

    const response = {
      claim: safeClaim,
      ...analysis,
      // Attach the local ML result as a secondary signal
      mlAnalysis: mlResult || null,
      searchedAt: new Date().toISOString(),
      fromCache: false,
    };
    cacheSet(safeClaim, response);
    res.json(response);
  } catch (err) {
    console.error('Verification failed:', err.message);
    res.status(502).json({ error: err.message || 'Verification failed. Please try again.' });
  }
});

export default router;
