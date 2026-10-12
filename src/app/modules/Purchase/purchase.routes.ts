import express from 'express';
import { PurchaseController } from './purchase.controller';
import validateRequest from '../../middleware/validationRequest';
import { PurchaseValidation } from './purchase.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.post('/', auth('admin', 'manager'), validateRequest(PurchaseValidation.createPurchaseValidationSchema), PurchaseController.createPurchase);
router.get('/', auth('admin', 'manager', 'cashier'), PurchaseController.getAllPurchases);
router.get('/:id', auth('admin', 'manager', 'cashier'), PurchaseController.getPurchaseById);

export const PurchaseRoutes = router;
