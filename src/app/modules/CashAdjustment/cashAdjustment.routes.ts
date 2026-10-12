import express from 'express';
import { CashAdjustmentController } from './cashAdjustment.controller';
import validateRequest from '../../middleware/validationRequest';
import { CashAdjustmentValidation } from './cashAdjustment.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.post('/', auth('admin', 'manager'), validateRequest(CashAdjustmentValidation.createCashAdjustmentValidationSchema), CashAdjustmentController.postAdjustment);
router.get('/', auth('admin', 'manager', 'cashier'), CashAdjustmentController.getAdjustments);

export const CashAdjustmentRoutes = router;
