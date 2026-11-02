import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kiaan_ai',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10)
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'ollama',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://159.198.65.194:11434',
    ollamaDefaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'gemma3:4b',
    ollamaToolModel: process.env.OLLAMA_TOOL_MODEL || 'qwen2.5:3b',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    grokApiKey: process.env.GROK_API_KEY || '',
    grokBaseUrl: process.env.GROK_BASE_URL || 'https://api.x.ai/v1',
    grokDefaultModel: process.env.GROK_DEFAULT_MODEL || 'grok-4.20-0309-non-reasoning'
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY || '',
    enabled: process.env.TAVILY_SEARCH_ENABLED === 'true'
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    enabled: process.env.AI_QUEUE_ENABLED === 'true',
    concurrency: parseInt(process.env.AI_QUEUE_CONCURRENCY || '1', 10),
    attempts: parseInt(process.env.AI_QUEUE_ATTEMPTS || '2', 10),
    backoffDelay: parseInt(process.env.AI_QUEUE_BACKOFF || '3000', 10)
  },
  upload: {
    dir: path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads'),
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10)
  },
  comfyUI: {
    baseUrl: process.env.COMFYUI_URL || 'http://127.0.0.1:8188',
    enabled: process.env.COMFYUI_ENABLED !== 'false',
    defaultModel: process.env.SD_MODEL_NAME || 'v1-5-pruned-emaonly.safetensors',
    concurrency: parseInt(process.env.IMAGE_QUEUE_CONCURRENCY || '1', 10),
    steps: parseInt(process.env.SD_STEPS || '20', 10),
    cfg: parseFloat(process.env.SD_CFG || '7.0'),
    sampler: process.env.SD_SAMPLER || 'euler_ancestral',
    scheduler: process.env.SD_SCHEDULER || 'normal',
    width: parseInt(process.env.SD_WIDTH || '512', 10),
    height: parseInt(process.env.SD_HEIGHT || '512', 10)
  }
};
