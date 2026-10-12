import express from 'express';
import { ProductLinkController } from './productLink.controller';
import validateRequest from '../../middleware/validationRequest';
import { ProductLinkValidation } from './productLink.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.post('/', auth('admin', 'manager'), validateRequest(ProductLinkValidation.createProductLinkValidationSchema), ProductLinkController.linkProducts);
router.get('/', auth('admin', 'manager', 'cashier'), ProductLinkController.getLinks);

export const ProductLinkRoutes = router;
