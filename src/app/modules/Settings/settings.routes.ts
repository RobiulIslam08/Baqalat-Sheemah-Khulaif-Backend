import express from 'express';
import { SettingsController } from './settings.controller';
import validateRequest from '../../middleware/validationRequest';
import { SettingsValidation } from './settings.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.get('/branding', SettingsController.getBranding);
router.get('/', auth('admin', 'manager', 'cashier', 'developer'), SettingsController.getSettings);
router.patch('/', auth('admin', 'developer'), validateRequest(SettingsValidation.updateSettingsValidationSchema), SettingsController.updateSettings);
router.post('/reset-demo', auth('admin', 'developer'), SettingsController.resetDemo);
router.post('/delete-all', auth('admin', 'developer'), SettingsController.deleteAll);

export const SettingsRoutes = router;
