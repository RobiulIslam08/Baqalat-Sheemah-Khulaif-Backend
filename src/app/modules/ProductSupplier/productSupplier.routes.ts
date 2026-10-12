import express from 'express';
import { ProductSupplierController } from './productSupplier.controller';
import validateRequest from '../../middleware/validationRequest';
import { ProductSupplierValidation } from './productSupplier.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.post('/', auth('admin', 'manager'), validateRequest(ProductSupplierValidation.createProductSupplierValidationSchema), ProductSupplierController.linkSupplier);
router.get('/', auth('admin', 'manager', 'cashier'), ProductSupplierController.getLinks);

export const ProductSupplierRoutes = router;
