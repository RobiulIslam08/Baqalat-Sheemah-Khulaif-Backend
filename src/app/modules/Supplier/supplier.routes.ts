import express from 'express';
import { SupplierController } from './supplier.controller';
import validateRequest from '../../middleware/validationRequest';
import { SupplierValidation } from './supplier.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.post('/', auth('admin', 'manager'), validateRequest(SupplierValidation.createSupplierValidationSchema), SupplierController.createSupplier);
router.get('/', auth('admin', 'manager', 'cashier'), SupplierController.getAllSuppliers);
router.get('/:id', auth('admin', 'manager', 'cashier'), SupplierController.getSupplierById);
router.patch('/:id', auth('admin', 'manager'), validateRequest(SupplierValidation.updateSupplierValidationSchema), SupplierController.updateSupplier);
router.delete('/:id', auth('admin'), SupplierController.deleteSupplier);

export const SupplierRoutes = router;
