import express from 'express';
import { SaleController } from './sale.controller';
import validateRequest from '../../middleware/validationRequest';
import { SaleValidation } from './sale.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.post('/', auth('admin', 'manager', 'cashier'), validateRequest(SaleValidation.createSaleValidationSchema), SaleController.createSale);
router.get('/', auth('admin', 'manager', 'cashier'), SaleController.getAllSales);
router.get('/:billNo', auth('admin', 'manager', 'cashier'), SaleController.getSaleByBillNo);
router.post('/return', auth('admin', 'manager', 'cashier'), validateRequest(SaleValidation.createSalesReturnValidationSchema), SaleController.createSalesReturn);

export const SaleRoutes = router;
