import path from 'path';
import fs from 'fs';
import { AttachmentService } from '../services/attachmentService.js';

export class AttachmentController {
  static async uploadFiles(req, res, next) {
    try {
      const { conversationId } = req.body;
      if (!conversationId) {
        return res.status(400).json({ success: false, error: 'conversationId is required' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, error: 'No files uploaded' });
      }

      const attachments = [];
      for (const file of req.files) {
        const saved = await AttachmentService.saveAttachment({
          conversationId,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          storagePath: file.path
        });
        attachments.push(saved);
      }

      res.status(201).json({ success: true, attachments });
    } catch (err) {
      next(err);
    }
  }

  static async getFile(req, res, next) {
    try {
      const { id } = req.params;
      const attachment = await AttachmentService.getAttachmentById(id, req.user.id);

      if (!attachment) {
        return res.status(404).json({ success: false, error: 'Attachment not found or unauthorized' });
      }

      if (!fs.existsSync(attachment.storage_path)) {
        return res.status(404).json({ success: false, error: 'File not found on server' });
      }

      res.setHeader('Content-Type', attachment.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.original_name)}"`);
      const fileStream = fs.createReadStream(attachment.storage_path);
      fileStream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  static async deleteAttachment(req, res, next) {
    try {
      const { id } = req.params;
      const result = await AttachmentService.deleteAttachment(id, req.user.id);
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }
}

