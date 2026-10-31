import { TavilyService } from './src/services/search/tavilyService.js';
import { config } from './src/config/index.js';

async function runTests() {
  console.log('=== Step 1: Configuration & Availability Test ===');
  console.log('Tavily Enabled in config:', config.tavily.enabled);
  console.log('Tavily Key present:', Boolean(config.tavily.apiKey));
  const isAvail = TavilyService.isAvailable();
  console.log('TavilyService.isAvailable():', isAvail);
  if (!isAvail) {
    throw new Error('TavilyService should be available but returned false');
  }

  console.log('\n=== Step 2: Intent Classification Test ===');
  const testCases = [
    { prompt: 'Hey I am Rohit', expected: false },
    { prompt: 'write a python function to reverse a string', expected: false },
    { prompt: 'what is recursion in javascript', expected: false },
    { prompt: 'what is 25 * 4', expected: false },
    { prompt: 'what are the latest technology announcements in 2026?', expected: true },
    { prompt: 'who won the latest cricket match today?', expected: true },
    { prompt: 'current weather in Delhi', expected: true },
    { prompt: 'hi', explicit: true, expected: true } // explicit toggle forces search
  ];

  for (const tc of testCases) {
    const result = TavilyService.shouldSearch(tc.prompt, tc.explicit || false);
    const pass = result === tc.expected;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] "${tc.prompt}" (explicit: ${Boolean(tc.explicit)}) -> ${result} (expected: ${tc.expected})`);
    if (!pass) throw new Error(`Intent classification test failed for prompt: "${tc.prompt}"`);
  }

  console.log('\n=== Step 3: Live Tavily API Search Call ===');
  const searchStart = performance.now();
  const searchResult = await TavilyService.search('latest developments in artificial intelligence 2026', { maxResults: 3 });
  const searchDuration = Math.round(performance.now() - searchStart);
  console.log(`Search completed in ${searchDuration}ms`);

  if (!searchResult) {
    throw new Error('Tavily search returned null');
  }
  console.log('Query:', searchResult.query);
  console.log('Direct Answer:', searchResult.answer ? searchResult.answer.slice(0, 150) + '...' : 'None');
  console.log('Results count:', searchResult.results.length);

  if (searchResult.results.length === 0) {
    throw new Error('Expected at least 1 search result from Tavily');
  }

  for (let i = 0; i < searchResult.results.length; i++) {
    const r = searchResult.results[i];
    console.log(`Source ${i + 1}: [${r.title}](${r.url})`);
  }

  console.log('\n=== Step 4: Prompt Formatting & Clickable Links Test ===');
  const formattedPrompt = TavilyService.formatForPrompt(searchResult);
  console.log('Formatted Prompt Length:', formattedPrompt.length);
  const containsSources = formattedPrompt.includes('Verified Live Web Sources:');
  const containsInstructions = formattedPrompt.includes('ALWAYS cite the relevant sources using clickable Markdown links: e.g. [Source Title](URL)');
  console.log('Contains Sources Header:', containsSources);
  console.log('Contains Citation Instructions:', containsInstructions);
  if (!containsSources || !containsInstructions) {
    throw new Error('Prompt formatting missing required source or citation instructions');
  }

  console.log('\n=== Step 5: Graceful Fallback Test (Invalid Key) ===');
  const originalKey = config.tavily.apiKey;
  config.tavily.apiKey = 'invalid-test-key';
  const fallbackResult = await TavilyService.search('test query', { maxResults: 1 });
  console.log('Search with invalid key returned:', fallbackResult); // Should be null, no crash
  config.tavily.apiKey = originalKey; // Restore

  console.log('\n=== ALL TAVILY TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

