import { Router } from 'express';
import { HealthController } from '../controllers/healthController.js';
import { ModelController } from '../controllers/modelController.js';
import { ConversationController } from '../controllers/conversationController.js';
import { MessageController } from '../controllers/messageController.js';
import { AttachmentController } from '../controllers/attachmentController.js';
import { SearchController } from '../controllers/searchController.js';
import { MemoryController } from '../controllers/memoryController.js';
import { FeedbackController } from '../controllers/feedbackController.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

export const apiRouter = Router();

// Public / Health & Models
apiRouter.get('/health', HealthController.check);
apiRouter.get('/models', ModelController.listModels);

// Authenticated Routes
apiRouter.use(authMiddleware);

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

