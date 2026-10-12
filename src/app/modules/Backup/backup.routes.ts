import path from 'path';
import express from 'express';
import catchAsync from '../../utils/catchAsync';
import auth from '../../middleware/auth';
import { exportDatabase, replaceDatabase } from '../../DB/sqlite';

const router = express.Router();

const downloadBackup = catchAsync(async (_req, res) => {
  const file = await exportDatabase();
  const name = `pos-backup-${new Date().toISOString().slice(0, 10)}.db`;
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(file);
});

const restoreBackup = catchAsync(async (req, res) => {
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length < 100) {
    res.status(400).json({ success: false, message: 'Invalid backup file' });
    return;
  }
  await replaceDatabase(body);
  res.json({
    success: true,
    message: 'Database restored. Sign in again to use the restored data.',
  });
});

const backupInfo = catchAsync(async (_req, res) => {
  const dataDir = process.env.POS_DATA_DIR || path.join(process.cwd(), 'data');
  res.json({
    success: true,
    message: 'Backup info',
    data: {
      databaseFile: path.join(dataDir, 'pos.db'),
      autoBackupFolder: path.join(dataDir, 'backups'),
    },
  });
});

router.get('/info', auth('admin', 'developer'), backupInfo);
router.get('/download', auth('admin', 'developer'), downloadBackup);
router.post(
  '/restore',
  auth('admin', 'developer'),
  express.raw({ type: 'application/octet-stream', limit: '500mb' }),
  restoreBackup,
);

export const BackupRoutes = router;
