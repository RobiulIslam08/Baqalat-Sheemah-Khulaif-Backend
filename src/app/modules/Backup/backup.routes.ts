import express from 'express';
import catchAsync from '../../utils/catchAsync';
import auth from '../../middleware/auth';
import { exportCollections, replaceCollections } from '../../DB/collection';

const router = express.Router();

const downloadBackup = catchAsync(async (_req, res) => {
  const data = await exportCollections();
  const name = `pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(JSON.stringify({ exportedAt: new Date().toISOString(), collections: data }));
});

const restoreBackup = catchAsync(async (req, res) => {
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length < 20) {
    res.status(400).json({ success: false, message: 'Invalid backup file' });
    return;
  }
  let parsed: { collections?: Record<string, unknown[]> };
  try {
    parsed = JSON.parse(body.toString('utf8'));
  } catch {
    res.status(400).json({ success: false, message: 'Backup file must be JSON' });
    return;
  }
  if (!parsed?.collections || typeof parsed.collections !== 'object') {
    res.status(400).json({ success: false, message: 'Backup file has no collections' });
    return;
  }
  await replaceCollections(parsed.collections);
  res.json({
    success: true,
    message: 'Database restored. Sign in again to use the restored data.',
  });
});

const backupInfo = catchAsync(async (_req, res) => {
  res.json({
    success: true,
    message: 'Backup info',
    data: {
      database: 'MongoDB sheemah_pos',
      format: 'json',
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
