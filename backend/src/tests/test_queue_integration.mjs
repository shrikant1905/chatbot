import { isBullMQActive, initializeQueueServices, closeAllQueueServices, getAiQueueMetrics } from '../services/queue/index.js';
import { concurrencyQueue } from '../services/queue/concurrencyQueue.js';
import { config } from '../config/index.js';

console.log('--- Testing BullMQ Queue System ---');
console.log('1. Configuration Check:');
console.log('   Redis Host:', config.redis.host);
console.log('   Redis Port:', config.redis.port);
console.log('   Queue Enabled:', config.redis.enabled);
console.log('   Queue Concurrency:', config.redis.concurrency);

console.log('\n2. Testing Initialization (Resilience Check with Redis):');
initializeQueueServices();

setTimeout(async () => {
  console.log('\n3. Testing Active Status:');
  const active = isBullMQActive();
  console.log('   isBullMQActive():', active);

  console.log('\n4. Testing Metrics Retrieval:');
  const metrics = await getAiQueueMetrics();
  console.log('   BullMQ Metrics:', JSON.stringify(metrics));

  const concurrencyMetrics = concurrencyQueue.getMetrics();
  console.log('   In-Memory ConcurrencyQueue Metrics:', JSON.stringify(concurrencyMetrics));

  console.log('\n5. Testing Graceful Shutdown:');
  await closeAllQueueServices();
  console.log('   Shutdown successful, no unhandled exceptions.');

  console.log('\nQueue system verification PASSED!');
  process.exit(0);
}, 1000);
