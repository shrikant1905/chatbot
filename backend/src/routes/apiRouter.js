import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { HealthController } from '../controllers/healthController.js';
import { ModelController } from '../controllers/modelController.js';
import { ConversationController } from '../controllers/conversationController.js';
import { MessageController } from '../controllers/messageController.js';
import { AttachmentController } from '../controllers/attachmentController.js';
import { SearchController } from '../controllers/searchController.js';
import { MemoryController } from '../controllers/memoryController.js';
import { FeedbackController } from '../controllers/feedbackController.js';
import { GatewayController } from '../controllers/gatewayController.js';
import { VisionController } from '../controllers/visionController.js';
import { ImageController } from '../controllers/imageController.js';
import { AuthController } from '../controllers/authController.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

export const apiRouter = Router();

// Public / Health & Models
apiRouter.get('/health', HealthController.check);
apiRouter.get('/health/benchmark', HealthController.benchmark);
apiRouter.get('/models', ModelController.listModels);
apiRouter.get('/images/health', ImageController.health);
apiRouter.get('/images/file/:filename', ImageController.serveFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logoFilePath = path.resolve(__dirname, '../../../frontend/public/assets/kiaan-orb-3d.png');

// Public App Icon Logo Endpoints
apiRouter.get('/app-icon', (req, res) => res.sendFile(logoFilePath));
apiRouter.get('/app-icon/download', (req, res) => {
  res.download(logoFilePath, 'kiaan-ai-logo.png', (err) => {
    if (err) res.status(404).json({ success: false, error: 'Logo file not found' });
  });
});

// Authentication Routes (Public)
apiRouter.post('/auth/register', AuthController.register);
apiRouter.post('/auth/login', AuthController.login);

// Authenticated Routes
apiRouter.use(authMiddleware);

// Current User Session Profile
apiRouter.get('/auth/me', AuthController.me);

// Conversations
apiRouter.get('/conversations', ConversationController.list);
apiRouter.post('/conversations', ConversationController.create);
apiRouter.get('/conversations/:id', ConversationController.get);
apiRouter.patch('/conversations/:id', ConversationController.rename);
apiRouter.put('/conversations/:id', ConversationController.rename);
apiRouter.delete('/conversations/:id', ConversationController.delete);
apiRouter.delete('/conversations/:id/messages', ConversationController.clearMessages);

// Messages
apiRouter.get('/conversations/:conversationId/messages', MessageController.listMessages);
apiRouter.post('/conversations/:conversationId/messages', MessageController.sendMessage);
apiRouter.post('/conversations/:conversationId/regenerate', MessageController.regenerateMessage);

// Attachments
apiRouter.post('/attachments/upload', upload.array('files', 5), AttachmentController.uploadFiles);
apiRouter.get('/attachments/:id/file', AttachmentController.getFile);
apiRouter.delete('/attachments/:id', AttachmentController.deleteAttachment);

// Search & Search History
apiRouter.get('/search', SearchController.search);
apiRouter.get('/search/history', SearchController.getHistory);
apiRouter.delete('/search/history', SearchController.clearHistory);
apiRouter.delete('/search/history/:id', SearchController.deleteHistoryItem);

// Conversational User Memory
apiRouter.get('/memory', MemoryController.getMemories);
apiRouter.post('/memory', MemoryController.saveMemory);
apiRouter.delete('/memory/:id', MemoryController.deleteMemory);

// Feedback
apiRouter.post('/feedback', FeedbackController.submit);

// Universal AI Gateway (Products, Tools, Concurrency Queue)
apiRouter.get('/gateway/products', GatewayController.listProducts);
apiRouter.post('/gateway/register-product', GatewayController.registerProduct);
apiRouter.get('/gateway/tools', GatewayController.listTools);
apiRouter.post('/gateway/tools/execute', GatewayController.executeTool);
apiRouter.post('/gateway/tools/approve', GatewayController.approveTool);
apiRouter.get('/gateway/queue/status', GatewayController.getQueueMetrics);

// Multimodal Vision & Image Analysis Endpoint
apiRouter.post('/ai/image/analyze', upload.single('image'), VisionController.analyzeImage);

// ComfyUI & Stable Diffusion 1.5 Image Generation
apiRouter.post('/images/generate', ImageController.generateImage);

