import { config } from '../../config/index.js';

export class TavilyService {
  static API_URL = 'https://api.tavily.com/search';

  /**
   * Check if Tavily Web Search is enabled and properly configured with an API key.
   */
  static isAvailable() {
    return Boolean(config.tavily?.enabled && config.tavily?.apiKey && config.tavily.apiKey.trim().length > 0);
  }

  /**
   * Intelligent Intent Classifier:
   * Determines whether a query genuinely requires live Internet search.
   * Prevents credit waste on standard coding, math, greetings, or conversational questions.
   *
   * @param {string} prompt - The user prompt
   * @param {boolean} [explicitFlag=false] - Whether the user explicitly clicked the web search toggle
   * @returns {boolean}
   */
  static shouldSearch(prompt, explicitFlag = false) {
    if (explicitFlag) {
      return true;
    }

    if (!prompt || typeof prompt !== 'string') {
      return false;
    }

    const trimmed = prompt.trim().toLowerCase();

    // Skip very short inputs (e.g. "hi", "ok", "yes")
    if (trimmed.length < 5) {
      return false;
    }

    // Exclude common programming, coding, math, or purely conceptual questions unless explicit
    const codeExclusions = [
      /^(write|create|implement|code|generate|build|debug|fix)\s+(a|an|the)?\s*(function|script|code|algorithm|regex|sql|query|class|component|hook|test|app)\b/i,
      /^(explain|what is|how does)\s+(recursion|polymorphism|async\/await|closures|promises|quicksort|binary search|big o)\b/i,
      /^(hello|hi|hey|good morning|good evening|who are you|what can you do)\b/i,
      /^(solve|calculate|evaluate|factor|simplify)\s+[\d\s+\-*/^()=xXyYzZ]+/i
    ];

    for (const pattern of codeExclusions) {
      if (pattern.test(trimmed)) {
        return false;
      }
    }

    // Temporal, live, recent, and factual search patterns (including current year 2026 and future)
    const searchPatterns = [
      /\b(current|currently|latest|recent|recently|today|tonight|yesterday|tomorrow|this week|this month|this year|now|right now|live)\b/i,
      /\b(2025|2026|2027|2028|2029|2030)\b/i,
      /\b(news|weather|forecast|stock|stocks|crypto|price|valuation|market cap|score|match|tournament|ipl|cup|champion|standings)\b/i,
      /\b(who is the current|who won|what happened|what is the price of|who is dating|wife of|husband of|net worth|ceo of)\b/i,
      /\b(search the web|search web|google|browse the web|look up|search for|find online|check online)\b/i,
      /\b(release date|announcement|specs|specifications|launch date|iphone 1|pixel |galaxy s)\b/i
    ];

    return searchPatterns.some((pattern) => pattern.test(trimmed));
  }

  /**
   * Clean and normalize user prompt into an optimal search query string.
   */
  static extractSearchQuery(prompt) {
    if (!prompt || typeof prompt !== 'string') return '';
    return prompt
      .replace(/^(please\s+)?(search the web for|search the web|search for|look up|google|browse the web for|find online:?)\s*/i, '')
      .replace(/[?!.]+$/, '')
      .trim();
  }

  /**
   * Execute Tavily Search API request.
   *
   * @param {string} prompt - Raw query or user prompt
   * @param {Object} [options]
   * @param {number} [options.maxResults=3] - Number of search results to return
   * @param {AbortSignal} [options.signal] - Cancellation signal
   * @returns {Promise<{ query: string, answer: string|null, results: Array<{ title: string, url: string, content: string, score: number }> } | null>}
   */
  static async search(prompt, { maxResults = 3, signal } = {}) {
    if (!this.isAvailable()) {
      return null;
    }

    const query = this.extractSearchQuery(prompt) || prompt.trim();
    if (!query) {
      return null;
    }

    const apiKey = config.tavily.apiKey.trim();
    const startTime = performance.now();

    // 7-second timeout controller so a slow network never hangs the chat
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 7000);

    const abortHandler = () => {
      timeoutController.abort();
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      console.log(`[Tavily Search] Querying live web: "${query}" (Max results: ${maxResults})`);

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          include_answer: true,
          include_raw_content: false,
          max_results: Math.min(Math.max(maxResults, 1), 4)
        }),
        signal: timeoutController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(`[Tavily Search Error] HTTP ${response.status}: ${errorText || response.statusText}`);
        return null;
      }

      const data = await response.json();
      const elapsedMs = Math.round(performance.now() - startTime);
      const rawResults = Array.isArray(data.results) ? data.results : [];

      console.log(`[Tavily Search Success] Retrieved ${rawResults.length} sources in ${elapsedMs}ms`);

      const sanitizedResults = rawResults.slice(0, maxResults).map((r) => ({
        title: (r.title || 'Untitled Source').trim(),
        url: (r.url || '').trim(),
        content: (r.content || '').slice(0, 250).trim(),
        score: typeof r.score === 'number' ? r.score : 0
      })).filter((r) => Boolean(r.url));

      return {
        query,
        answer: data.answer || null,
        results: sanitizedResults
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError' || signal?.aborted) {
        console.warn('[Tavily Search] Search request timed out or was aborted by user.');
      } else {
        console.warn('[Tavily Search Exception]', err.message);
      }
      return null;
    } finally {
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  /**
   * Format Tavily search results into a clean, compact system context block
   * optimized for CPU-based Ollama models (Gemma 3 4B).
   *
   * @param {Object} searchData - Structured search results
   * @returns {string} Formatted context block
   */
  static formatForPrompt(searchData) {
    if (!searchData || !searchData.results || searchData.results.length === 0) {
      return '';
    }

    const currentDateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const sourcesList = searchData.results
      .slice(0, 3)
      .map((r, i) => `[${i + 1}] [${r.title}](${r.url}): ${r.content}`)
      .join('\n');

    return [
      `[Real-Time Live Web Search Information (Year: 2026, Date: ${currentDateStr})]`,
      `User Question: "${searchData.query}"`,
      searchData.answer ? `Verified Quick Answer: ${searchData.answer}` : '',
      `Verified Live Web Sources:\n${sourcesList}`,
      `Instructions for Web Search Response:\n- Synthesize an accurate, concise answer based on the verified information above.\n- ALWAYS cite the relevant sources using clickable Markdown links: e.g. [Source Title](URL).\n- Do not invent non-existent facts.`
    ].filter(Boolean).join('\n\n');
  }
}
