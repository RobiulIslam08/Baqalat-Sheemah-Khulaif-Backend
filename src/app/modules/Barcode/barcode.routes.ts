import express from 'express';
import { BarcodeController } from './barcode.controller';
import validateRequest from '../../middleware/validationRequest';
import { BarcodeValidation } from './barcode.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.post('/generate', auth('admin', 'manager', 'cashier'), validateRequest(BarcodeValidation.generateBarcodeValidationSchema), BarcodeController.generateLabels);
router.get('/', auth('admin', 'manager', 'cashier'), BarcodeController.getJobs);

export const BarcodeRoutes = router;
