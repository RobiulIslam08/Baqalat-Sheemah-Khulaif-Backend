import express from 'express';
import { CreditController } from './credit.controller';
import validateRequest from '../../middleware/validationRequest';
import { CreditValidation } from './credit.validation';
import auth from '../../middleware/auth';

const router = express.Router();

// Supplier credits
router.post('/supplier', auth('admin', 'manager'), validateRequest(CreditValidation.supplierCreditValidationSchema), CreditController.recordSupplierPayment);
router.get('/supplier', auth('admin', 'manager', 'cashier'), CreditController.getSupplierCredits);
router.patch('/supplier/:id/settle', auth('admin', 'manager'), CreditController.settleSupplierInvoice);

// Customer credits
router.post('/customer', auth('admin', 'manager'), validateRequest(CreditValidation.customerCreditValidationSchema), CreditController.receiveCustomerPayment);
router.get('/customer', auth('admin', 'manager', 'cashier'), CreditController.getCustomerCredits);

export const CreditRoutes = router;
