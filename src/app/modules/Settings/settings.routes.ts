import express from 'express';
import { SettingsController } from './settings.controller';
import validateRequest from '../../middleware/validationRequest';
import { SettingsValidation } from './settings.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.get('/', auth('admin', 'manager', 'cashier'), SettingsController.getSettings);
router.patch('/', auth('admin'), validateRequest(SettingsValidation.updateSettingsValidationSchema), SettingsController.updateSettings);
router.post('/reset-demo', auth('admin', 'developer'), SettingsController.resetDemo);

export const SettingsRoutes = router;
