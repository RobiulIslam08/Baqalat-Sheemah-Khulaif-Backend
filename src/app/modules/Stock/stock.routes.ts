import express from 'express';
import { StockController } from './stock.controller';
import validateRequest from '../../middleware/validationRequest';
import { StockValidation } from './stock.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.get('/', auth('admin', 'manager', 'cashier'), StockController.getStock);
router.get('/returns', auth('admin', 'manager', 'cashier'), StockController.getStockReturns);
router.post('/return', auth('admin', 'manager'), validateRequest(StockValidation.stockReturnValidationSchema), StockController.processReturn);
router.post('/correction', auth('admin', 'manager'), validateRequest(StockValidation.stockCorrectionValidationSchema), StockController.processCorrection);

export const StockRoutes = router;
