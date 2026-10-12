import express from 'express';
import { CustomerController } from './customer.controller';
import validateRequest from '../../middleware/validationRequest';
import { CustomerValidation } from './customer.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.post('/', auth('admin', 'manager'), validateRequest(CustomerValidation.createCustomerValidationSchema), CustomerController.createCustomer);
router.get('/', auth('admin', 'manager', 'cashier'), CustomerController.getAllCustomers);
router.get('/:id', auth('admin', 'manager', 'cashier'), CustomerController.getCustomerById);
router.patch('/:id', auth('admin', 'manager'), validateRequest(CustomerValidation.updateCustomerValidationSchema), CustomerController.updateCustomer);
router.delete('/:id', auth('admin'), CustomerController.deleteCustomer);

export const CustomerRoutes = router;
