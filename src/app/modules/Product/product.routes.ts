import express from 'express';
import { ProductController } from './product.controller';
import validateRequest from '../../middleware/validationRequest';
import { ProductValidation } from './product.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.post(
  '/',
  auth('admin', 'manager'),
  validateRequest(ProductValidation.createProductValidationSchema),
  ProductController.createProduct,
);

router.get(
  '/',
  auth('admin', 'manager', 'cashier'),
  ProductController.getAllProducts,
);

router.get(
  '/:id',
  auth('admin', 'manager', 'cashier'),
  ProductController.getProductById,
);

router.patch(
  '/:id',
  auth('admin', 'manager'),
  validateRequest(ProductValidation.updateProductValidationSchema),
  ProductController.updateProduct,
);

router.delete('/:id', auth('admin'), ProductController.deleteProduct);

export const ProductRoutes = router;
