/**
 * Centralized API Client for Kiaan AI
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    ...options.headers
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errData = await response.json();
      if (errData.error) errMessage = errData.error;
    } catch {}
    const error = new Error(errMessage);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export const apiClient = {
  // Health & Models
  getHealth: () => request('/health'),
  getModels: () => request('/models'),

  // Conversations
  getConversations: () => request('/conversations'),
  getConversation: (id) => request(`/conversations/${id}`),
  createConversation: (data) =>
    request('/conversations', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  renameConversation: (id, title) =>
    request(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title })
    }),
  deleteConversation: (id) =>
    request(`/conversations/${id}`, {
      method: 'DELETE'
    }),
  clearMessages: (conversationId) =>
    request(`/conversations/${conversationId}/messages`, {
      method: 'DELETE'
    }),

  // Message Sending with SSE Streaming Support
  sendMessage: async ({ conversationId, content, model, stream = true, attachmentIds = [], onChunk, signal }) => {
    const url = `${BASE_URL}/conversations/${conversationId}/messages`;

    if (!stream) {
      return request(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, model, stream: false, attachmentIds }),
        signal
      });
    }

    // SSE Streaming
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, model, stream: true, attachmentIds }),
      signal
    });

    if (!response.ok) {
      let errMessage = `Generation failed (${response.status})`;
      try {
        const errData = await response.json();
        if (errData.error) errMessage = errData.error;
      } catch {}
      throw new Error(errMessage);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let result = { userMessage: null, assistantMessage: null };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const eventStr of events) {
        const lines = eventStr.split('\n');
        let eventName = 'message';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventName = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6);
          }
        }

        if (!eventData) continue;

        try {
          const parsed = JSON.parse(eventData);
          if (eventName === 'user_message') {
            result.userMessage = parsed;
          } else if (eventName === 'chunk') {
            if (onChunk && parsed.delta) {
              onChunk(parsed.delta);
            }
          } else if (eventName === 'done') {
            result.assistantMessage = parsed.message;
          } else if (eventName === 'error') {
            throw new Error(parsed.error || 'AI generation encountered an error.');
          }
        } catch (e) {
          if (e.message?.includes('AI generation') || e.message?.includes('Ollama')) {
            throw e;
          }
        }
      }
    }

    return result;
  },

  // Regenerate Response
  regenerateMessage: (conversationId, model) =>
    request(`/conversations/${conversationId}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ model })
    }),

  // File Attachments
  uploadFiles: async (conversationId, files) => {
    const formData = new FormData();
    formData.append('conversationId', conversationId);
    for (const file of files) {
      formData.append('files', file);
    }
    return request('/attachments/upload', {
      method: 'POST',
      body: formData
    });
  },

  deleteAttachment: (id) =>
    request(`/attachments/${id}`, {
      method: 'DELETE'
    }),

  getAttachmentFileUrl: (id) => `${BASE_URL}/attachments/${id}/file`,

  // Search & History
  search: (query, limit = 20) => request(`/search?q=${encodeURIComponent(query)}&limit=${limit}`),
  getSearchHistory: (limit = 15) => request(`/search/history?limit=${limit}`),
  clearSearchHistory: () => request('/search/history', { method: 'DELETE' }),
  deleteSearchHistoryItem: (id) => request(`/search/history/${id}`, { method: 'DELETE' }),

  // User Memory
  getMemories: () => request('/memory'),
  saveMemory: (keyName, valueText, category = 'general') =>
    request('/memory', {
      method: 'POST',
      body: JSON.stringify({ keyName, valueText, category })
    }),
  deleteMemory: (id) => request(`/memory/${id}`, { method: 'DELETE' }),

  // Feedback
  // Universal Gateway API
  getGatewayProducts: () => request('/gateway/products'),
  getGatewayTools: (domain) => request(`/gateway/tools${domain ? `?domain=${domain}` : ''}`),
  executeTool: (toolName, parameters = {}) =>
    request('/gateway/tools/execute', {
      method: 'POST',
      body: JSON.stringify({ toolName, parameters })
    }),
  approveTool: (toolName, parameters = {}) =>
    request('/gateway/tools/approve', {
      method: 'POST',
      body: JSON.stringify({ toolName, parameters })
    }),
  getQueueStatus: () => request('/gateway/queue/status'),
  analyzeImage: (file, prompt) => {
    const formData = new FormData();
    if (file instanceof File) formData.append('image', file);
    if (prompt) formData.append('prompt', prompt);
    return request('/ai/image/analyze', { method: 'POST', body: formData });
  },

  submitFeedback: (messageId, rating, comment = null) =>
    request('/feedback', {
      method: 'POST',
      body: JSON.stringify({ messageId, rating, comment })
    })
};

