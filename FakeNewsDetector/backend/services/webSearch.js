const SERP_URL = 'https://serpapi.com/search.json';
const MAX_RESULTS = 10;

// ─── Credibility List (Global + Indian Regional) ──────────────────────────────
const CREDIBLE = [
  // International wire & major outlets
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'npr.org', 'pbs.org',
  'theguardian.com', 'nytimes.com', 'washingtonpost.com', 'wsj.com',
  'bloomberg.com', 'ft.com', 'economist.com', 'aljazeera.com', 'cnn.com',
  'nbcnews.com', 'cbsnews.com', 'abcnews.go.com', 'dw.com', 'france24.com',
  'afp.com', 'factcheck.afp.com',
  // International fact-checkers
  'snopes.com', 'politifact.com', 'factcheck.org', 'fullfact.org',
  // Science / health authorities
  'who.int', 'un.org', 'nature.com', 'science.org', 'nih.gov', 'cdc.gov',
  'nasa.gov', 'lancet.com', 'bmj.com',
  // ─── INDIAN credible news & fact-checkers ──────────────────────────────────
  'thehindu.com', 'ndtv.com', 'indianexpress.com', 'hindustantimes.com',
  'timesofindia.indiatimes.com', 'livemint.com', 'business-standard.com',
  'thewire.in', 'scroll.in', 'theprint.in', 'firstpost.com', 'moneycontrol.com',
  'news18.com', 'zeenews.india.com', 'aajtak.in', 'abplive.com',
  // Indian fact-checkers
  'altnews.in', 'boomlive.in', 'factcheck.afp.com', 'vishvasnews.com',
  'newschecker.in', 'factly.in', 'thequint.com', 'webqoof.com',
  // Government (Indian)
  'pib.gov.in', 'mygov.in', 'india.gov.in', 'mohfw.gov.in', 'rbi.org.in',
  'sebi.gov.in', 'eci.gov.in',
];

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function credibilityScore(domain) {
  if (!domain) return 0;
  if (/\.(gov|mil)(\.[a-z]{2})?$/.test(domain) || /\.edu$/.test(domain)) return 3;
  if (CREDIBLE.some((d) => domain === d || domain.endsWith(`.${d}`))) return 2;
  return 0;
}

// ─── Language Detection (basic — detects Devanagari / Arabic etc.) ────────────
function detectLang(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi/Devanagari
  if (/[\u0600-\u06FF]/.test(text)) return 'ar'; // Arabic/Urdu
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'; // Tamil
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te'; // Telugu
  if (/[\u0980-\u09FF]/.test(text)) return 'bn'; // Bengali
  return 'en';
}

// ─── Smart Search Query Builder via OpenRouter ────────────────────────────────
async function extractSearchQueries(claim) {
  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  const prompt = `You are a search query extraction assistant.
Given a news claim, produce exactly 3 short, effective Google search queries:
1. Core factual keywords (names, numbers, events, dates — no filler words).
2. Same as #1 + "fact check" appended.
3. An alternative phrasing that a debunking article might use.

Return ONLY a valid JSON array of 3 strings. No explanation.
Example: ["UNESCO best anthem 2023", "UNESCO best anthem 2023 fact check", "India national anthem UNESCO award hoax"]

Claim: ${claim.slice(0, 500)}`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'FakeNewsDetector',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('Query LLM failed');
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const queries = JSON.parse(cleaned);
    if (Array.isArray(queries) && queries.every((q) => typeof q === 'string')) {
      return queries.slice(0, 3).map((q) => q.slice(0, 200));
    }
  } catch {
    // Fallback to simple truncation if LLM fails
  }
  const short = claim.replace(/\s+/g, ' ').slice(0, 200);
  return [short, `${short.slice(0, 160)} fact check`, `${short.slice(0, 160)} hoax OR false`];
}

// ─── Article Content Scraping via Jina Reader ─────────────────────────────────
async function scrapeArticle(url, timeoutMs = 5000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: { Accept: 'text/plain', 'X-No-Cache': 'true' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return '';
    const text = await res.text();
    // Return first 1500 chars of article body (enough for context)
    return text.slice(0, 1500).trim();
  } catch {
    return '';
  }
}

// ─── Run a Single SerpApi Query ───────────────────────────────────────────────
async function runQuery(q, lang = 'en') {
  const params = new URLSearchParams({
    engine: 'google',
    q,
    num: '10',
    hl: lang === 'en' ? 'en' : lang,
    api_key: process.env.SERPAPI_API_KEY,
  });
  const res = await fetch(`${SERP_URL}?${params}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    if (data.error && /hasn't returned any results/i.test(data.error)) return [];
    throw new Error(`Search failed: ${data.error || res.statusText}`);
  }
  const organic = (data.organic_results || []).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet || '',
    publishedDate: r.date || null,
    sourceName: r.source || null,
  }));
  const stories = (data.top_stories || []).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: '',
    publishedDate: r.date || null,
    sourceName: r.source || null,
  }));
  return [...stories, ...organic];
}

// ─── Main: Search + Scrape + Rank ────────────────────────────────────────────
export async function searchEvidence(claim) {
  const lang = detectLang(claim);
  const queries = await extractSearchQueries(claim);

  const batches = await Promise.all(queries.map((q) => runQuery(q, lang)));

  const seen = new Set();
  const merged = [];
  batches.flat().forEach((r, idx) => {
    const domain = domainOf(r.url);
    if (!r.title || !domain || seen.has(r.url)) return;
    // Skip social media / video-only pages with no snippet
    if (!r.snippet && /youtube\.com|facebook\.com|twitter\.com|instagram\.com|tiktok\.com/.test(domain)) return;
    seen.add(r.url);
    merged.push({ ...r, domain, credibility: credibilityScore(domain), rank: idx });
  });

  merged.sort((a, b) => b.credibility - a.credibility || a.rank - b.rank);
  const top = merged.slice(0, MAX_RESULTS);

  // Scrape the top 3 high-credibility sources for full article body
  const toScrape = top.slice(0, 3).filter((r) => r.credibility >= 2);
  const scraped = await Promise.all(
    toScrape.map(async (r) => {
      const body = await scrapeArticle(r.url);
      return { url: r.url, body };
    }),
  );
  const bodyMap = new Map(scraped.map((s) => [s.url, s.body]));

  return top.map(({ rank, ...r }, i) => ({
    id: `S${i + 1}`,
    ...r,
    articleBody: bodyMap.get(r.url) || '',
  }));
}
