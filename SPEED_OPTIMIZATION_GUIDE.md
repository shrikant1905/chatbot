# Kiaan Universal AI Gateway — Speed & Concurrency Optimization Guide

This guide details the exact production settings to achieve low-latency AI responses on CPU-constrained servers (8 vCPUs, 11 GB RAM).

---

## 1. Model Selection Benchmark (CPU Envelope)

| Model | Quantization | RAM Usage | Cold Start | First-Token Latency (CPU) | Recommendation for Kiaan Gateway |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`qwen2.5:1.5b`** | Q4_K_M | ~1.2 GB | ~1.5s | **~250ms** | **Ultra-Fast**: Best for high-frequency classification, entity extraction, and instant chat. |
| **`qwen2.5:3b`** | Q4_K_M | ~2.2 GB | ~2.5s | **~450ms** | **Gold Standard (Recommended)**: Exceptional balance of speed, Hindi/English fluency, and function calling. |
| **`qwen3:1.7b`** | Q4_K_M | ~1.5 GB | ~1.8s | **~6s–12s** *(due to `<think>`)* | **Analytical Only**: Use when deep mathematical or complex policy reasoning is required. |
| **`qwen2.5:7b`** | Q4_K_M | ~4.7 GB | ~5.0s | **~1.8s–3.5s** | **High Precision**: Use only when single-user deep report drafting is active. |

> [!TIP]
> For everyday SaaS actions (searching leads, checking inventory, drafting emails), **`qwen2.5:3b`** is **3x to 5x faster** than `qwen3:1.7b` because it eliminates the internal chain-of-thought delay.

---

## 2. Server-Side Ollama Optimization (Ubuntu VPS)

To prevent Ollama from dropping connections or unloading models from memory:

Edit `/etc/systemd/system/ollama.service`:
```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/environment.conf << 'EOF'
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=*"
Environment="OLLAMA_KEEP_ALIVE=24h"
Environment="OLLAMA_NUM_PARALLEL=2"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
EOF

sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### What these settings do:
* `OLLAMA_KEEP_ALIVE=24h`: Pins the model in RAM continuously. Zero cold-start latency.
* `OLLAMA_NUM_PARALLEL=2`: Prevents CPU starvation by capping parallel inference slots.
* `OLLAMA_MAX_LOADED_MODELS=1`: Prevents RAM exhaustion from loading multiple weights simultaneously.

---

## 3. Node.js Gateway Optimizations

### 3.1 Payload Parameters
When invoking Ollama `/api/chat`, pass these tuned parameters:
```javascript
const payload = {
  model: selectedModel,
  messages: formattedMessages,
  stream: true,
  keep_alive: '24h',
  options: {
    num_thread: 8,      // Allocates all 8 CPU cores to mathematical matrix ops
    num_ctx: 2048,      // Caps context window; prevents CPU quadratic slow-down
    temperature: 0.6,   // Focused determinism for tool arguments
    top_p: 0.9,
    repeat_penalty: 1.1
  }
};
```

### 3.2 Output Token Ceilings
* For tool calling & intent classification: set `max_tokens: 350`.
* For standard chat responses: set `max_tokens: 800`.
* Avoid unbounded completions that consume CPU cycles generating excessive prose.

---

## 4. Concurrency Management with BullMQ & Redis

To protect the server from 100 simultaneous requests:

```
[100 Incoming Requests]
          │
          ▼
   [Express Router]
          │
   ┌──────┴────────────────────────┐
   ▼                               ▼
[Redis Cache Check]       [Non-cached Queries]
(5ms response)                     │
                                   ▼
                       [BullMQ FIFO Queue]
                       (Concurrency: 2 Workers)
                                   │
                                   ▼
                         [Ollama CPU Engine]
                         (Safe & Fast Latency)
```

1. **Redis Hot-Cache:** If two users ask the exact same FAQ or status question within 10 minutes, the response is served in **5ms** directly from Redis without hitting Ollama.
2. **BullMQ Worker Throttle:** BullMQ allows **exactly 2 jobs** to execute concurrently on the 8 CPU cores. The remaining requests wait in an orderly queue and stream their responses as slots free up.

