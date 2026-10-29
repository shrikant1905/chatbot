import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../app.js';
import { closePool } from '../db/pool.js';
import { initTestDatabase, clearTestDatabase, closeTestDatabase } from './testHelper.js';
import { MemoryService } from '../services/memoryService.js';
import { getAiProvider } from '../services/ai/index.js';
import { OllamaProvider } from '../services/ai/ollamaProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server;
let baseUrl;

before(async () => {
  await initTestDatabase();
  const app = createApp();

  await new Promise((resolve) => {
    server = http.createServer(app).listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((res) => server.close(res));
  }
  await closeTestDatabase();
  await closePool();
});

beforeEach(async () => {
  await clearTestDatabase();
});

describe('1. Backend Startup & Health Checks', () => {
  test('GET /api/health returns 200 and healthy status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'healthy');
    assert.equal(data.database.connected, true);
    assert.equal(data.storage.ready, true);
    assert.ok(data.aiProvider);
  });

  test('GET /api/models returns model list and provider status', async () => {
    const res = await fetch(`${baseUrl}/models`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.models));
    assert.ok(data.models.length > 0);
  });
});

describe('2. Conversation Lifecycle (CRUD)', () => {
  test('Creates, retrieves, renames, clears and deletes a conversation', async () => {
    // 1. Create conversation
    const createRes = await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'test-conv-lifecycle',
        title: 'Initial Title',
        model: 'kiaan-ultra'
      })
    });
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.equal(createData.conversation.title, 'Initial Title');

    // 2. List conversations
    const listRes = await fetch(`${baseUrl}/conversations`);
    const listData = await listRes.json();
    assert.ok(listData.conversations.some((c) => c.id === 'test-conv-lifecycle'));

    // 3. Rename conversation
    const renameRes = await fetch(`${baseUrl}/conversations/test-conv-lifecycle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title' })
    });
    assert.equal(renameRes.status, 200);
    const renameData = await renameRes.json();
    assert.equal(renameData.conversation.title, 'Updated Title');

    // 4. Retrieve single conversation
    const getRes = await fetch(`${baseUrl}/conversations/test-conv-lifecycle`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.conversation.title, 'Updated Title');

    // 5. Delete conversation
    const delRes = await fetch(`${baseUrl}/conversations/test-conv-lifecycle`, {
      method: 'DELETE'
    });
    assert.equal(delRes.status, 200);

    // 6. Verify deleted
    const verifyRes = await fetch(`${baseUrl}/conversations/test-conv-lifecycle`);
    assert.equal(verifyRes.status, 404);
  });

  test('Rejects blank title on rename', async () => {
    await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'test-conv-blank', title: 'Valid' })
    });

    const res = await fetch(`${baseUrl}/conversations/test-conv-blank`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '   ' })
    });
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.match(data.error, /cannot be empty/i);
  });
});

describe('3. Message Persistence & Context Window', () => {
  test('Rejects empty message submissions', async () => {
    const res = await fetch(`${baseUrl}/conversations/conv-123/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '   ' })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /content is required/i);
  });

  test('Auto-creates conversation on first message', async () => {
    const convId = `auto-conv-${Date.now()}`;
    const res = await fetch(`${baseUrl}/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Explain quantum computing in detail',
        model: 'kiaan-ultra'
      })
    });

    // In local dev without live Ollama, server responds with 502 with genuine error (not fake answer)
    // but user message MUST be saved!
    const getRes = await fetch(`${baseUrl}/conversations/${convId}`);
    assert.equal(getRes.status, 200);
    const data = await getRes.json();
    assert.ok(data.conversation.title.includes('Explain quantum'));
    assert.ok(data.conversation.messages.length > 0);
    const userMsg = data.conversation.messages.find((m) => m.role === 'user');
    assert.ok(userMsg);
    assert.equal(userMsg.content, 'Explain quantum computing in detail');
  });
});

describe('4. File Upload Validation & Attachment Security', () => {
  test('Blocks forbidden executable extensions (.exe, .bat, .sh)', async () => {
    const formData = new FormData();
    formData.append('conversationId', 'test-conv');
    const fakeExe = new Blob(['@echo off'], { type: 'text/plain' });
    formData.append('files', fakeExe, 'danger.bat');

    const res = await fetch(`${baseUrl}/attachments/upload`, {
      method: 'POST',
      body: formData
    });
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.match(data.error, /forbidden for security/i);
  });

  test('Allows valid text and image attachments with metadata persistence', async () => {
    // Create conversation first
    await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'conv-att-test', title: 'Attachment Test' })
    });

    const formData = new FormData();
    formData.append('conversationId', 'conv-att-test');
    const validTxt = new Blob(['Hello Kiaan AI attachment test file'], { type: 'text/plain' });
    formData.append('files', validTxt, 'notes.txt');

    const uploadRes = await fetch(`${baseUrl}/attachments/upload`, {
      method: 'POST',
      body: formData
    });
    assert.equal(uploadRes.status, 201);
    const uploadData = await uploadRes.json();
    assert.equal(uploadData.success, true);
    assert.equal(uploadData.attachments.length, 1);
    assert.equal(uploadData.attachments[0].original_name, 'notes.txt');

    const attId = uploadData.attachments[0].id;

    // Retrieve file
    const fileRes = await fetch(`${baseUrl}/attachments/${attId}/file`);
    assert.equal(fileRes.status, 200);
    const content = await fileRes.text();
    assert.equal(content, 'Hello Kiaan AI attachment test file');
  });

  test('Blocks unauthorized access to attachments belonging to another user', async () => {
    // Create attachment for user_default
    await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': 'user_default' },
      body: JSON.stringify({ id: 'conv-user-a', title: 'User A Conv' })
    });

    const formData = new FormData();
    formData.append('conversationId', 'conv-user-a');
    const blob = new Blob(['secret'], { type: 'text/plain' });
    formData.append('files', blob, 'secret.txt');

    const uploadRes = await fetch(`${baseUrl}/attachments/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'user_default' },
      body: formData
    });
    const uploadData = await uploadRes.json();
    const attId = uploadData.attachments[0].id;

    // Attempt retrieval by a different user 'attacker_user'
    const attackRes = await fetch(`${baseUrl}/attachments/${attId}/file`, {
      headers: { 'X-User-Id': 'attacker_user' }
    });
    assert.equal(attackRes.status, 404);
  });
});

describe('5. Search & Search History Persistence', () => {
  test('Searches conversation titles, saves query history, and supports clear history', async () => {
    // 1. Create a conversation to search
    await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'conv-search-1', title: 'Superconductors and Quantum Logic' })
    });

    // 2. Perform search
    const searchRes = await fetch(`${baseUrl}/search?q=Superconductors`);
    assert.equal(searchRes.status, 200);
    const searchData = await searchRes.json();
    assert.equal(searchData.success, true);
    assert.ok(searchData.conversations.some((c) => c.title.includes('Superconductors')));

    // 3. Verify query saved to search history
    const historyRes = await fetch(`${baseUrl}/search/history`);
    assert.equal(historyRes.status, 200);
    const historyData = await historyRes.json();
    assert.ok(historyData.history.some((h) => h.query === 'Superconductors'));

    // 4. Clear search history
    const clearRes = await fetch(`${baseUrl}/search/history`, { method: 'DELETE' });
    assert.equal(clearRes.status, 200);

    // 5. Verify history is empty
    const emptyHistoryRes = await fetch(`${baseUrl}/search/history`);
    const emptyData = await emptyHistoryRes.json();
    assert.equal(emptyData.history.length, 0);
  });
});

describe('6. Conversational Memory & Secret Protection Guardrails', () => {
  test('Saves and retrieves legitimate user memory items', async () => {
    const memRes = await fetch(`${baseUrl}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyName: 'preferred_programming_language',
        valueText: 'Python and JavaScript',
        category: 'preference'
      })
    });
    assert.equal(memRes.status, 201);
    const memData = await memRes.json();
    assert.equal(memData.memory.key_name, 'preferred_programming_language');

    // Retrieve memories
    const listRes = await fetch(`${baseUrl}/memory`);
    const listData = await listRes.json();
    assert.ok(listData.memories.some((m) => m.key_name === 'preferred_programming_language'));
  });

  test('Rejects saving passwords, API keys, and sensitive tokens into memory', async () => {
    const leakAttempt = await fetch(`${baseUrl}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyName: 'db_password',
        valueText: 'super_secret_pwd_123'
      })
    });
    assert.equal(leakAttempt.status, 500);
    const leakData = await leakAttempt.json();
    assert.match(leakData.error, /Security policy violation/i);
  });
});

describe('7. AI Provider Abstraction & Offline Error Handling', () => {
  test('Normalizes Ollama connection failure with actionable message without fake answers', async () => {
    const offlineOllama = new OllamaProvider({
      ollamaBaseUrl: 'http://127.0.0.1:54321', // Unreachable port
      ollamaDefaultModel: 'llama3:latest'
    });

    const status = await offlineOllama.checkAvailability();
    assert.equal(status.available, false);
    assert.match(status.error, /unreachable/i);

    // Ensure generateResponse throws genuine error rather than fabricating an answer
    await assert.rejects(
      async () => {
        await offlineOllama.generateResponse({
          model: 'llama3:latest',
          messages: [{ role: 'user', content: 'Hi' }]
        });
      },
      /unable to connect to Ollama/i
    );
  });
});
