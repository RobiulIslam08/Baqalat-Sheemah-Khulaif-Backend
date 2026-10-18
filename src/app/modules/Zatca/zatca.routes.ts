import express from 'express';
import { ZatcaController } from './zatca.controller';
import validateRequest from '../../middleware/validationRequest';
import { onboardDeviceValidationSchema, processInvoiceValidationSchema } from './zatca.validation';
import auth from '../../middleware/auth';

const router = express.Router();

// 1. Device Onboarding & CSID Management
router.post(
  '/onboard',
  auth('admin', 'developer'),
  validateRequest(onboardDeviceValidationSchema),
  ZatcaController.onboardDevice
);

router.get(
  '/device/:branchId',
  auth('admin', 'manager', 'cashier', 'developer'),
  ZatcaController.getDeviceStatus
);

// 2. Invoice Clearance & Reporting
router.get(
  '/invoices',
  auth('admin', 'manager', 'cashier', 'developer'),
  ZatcaController.getAllInvoices
);

router.post(
  '/invoices/process',
  auth('admin', 'manager', 'cashier', 'developer'),
  validateRequest(processInvoiceValidationSchema),
  ZatcaController.processInvoice
);

router.post(
  '/invoices/retry/:invoiceId',
  auth('admin', 'manager', 'developer'),
  ZatcaController.retryInvoice
);

router.post(
  '/invoices/retry-all',
  auth('admin', 'manager', 'developer'),
  ZatcaController.retryAllPending
);

router.get(
  '/invoices/:invoiceId',
  auth('admin', 'manager', 'cashier', 'developer'),
  ZatcaController.getInvoiceDetails
);

router.get(
  '/invoices/:invoiceId/xml',
  auth('admin', 'manager', 'cashier', 'developer'),
  ZatcaController.downloadXml
);

// 3. Health & Gateway Diagnostics
router.get(
  '/health',
  auth('admin', 'manager', 'cashier', 'developer'),
  ZatcaController.checkGatewayHealth
);

export const ZatcaRoutes = router;
