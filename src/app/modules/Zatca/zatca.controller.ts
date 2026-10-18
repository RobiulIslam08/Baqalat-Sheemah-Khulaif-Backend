import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { ZatcaServices } from './zatca.service';

const onboardDevice = catchAsync(async (req, res) => {
  const result = await ZatcaServices.onboardDevice(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'ZATCA Phase 2 Device Onboarded Successfully',
    data: result,
  });
});

const processInvoice = catchAsync(async (req, res) => {
  const result = await ZatcaServices.processInvoice(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Invoice processed with status: ${result.zatcaStatus}`,
    data: result,
  });
});

const getDeviceStatus = catchAsync(async (req, res) => {
  const { branchId } = req.params;
  const result = await ZatcaServices.getDeviceStatus(branchId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Device status retrieved successfully',
    data: result,
  });
});

const getInvoiceDetails = catchAsync(async (req, res) => {
  const { invoiceId } = req.params;
  const result = await ZatcaServices.getInvoiceDetails(invoiceId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Invoice details retrieved successfully',
    data: result,
  });
});

const downloadXml = catchAsync(async (req, res) => {
  const { invoiceId } = req.params;
  const { fileName, xmlContent } = await ZatcaServices.downloadXml(invoiceId);

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(xmlContent);
});

const getAllInvoices = catchAsync(async (req, res) => {
  const result = await ZatcaServices.getAllInvoices(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ZATCA invoices retrieved successfully',
    data: result,
  });
});

const retryInvoice = catchAsync(async (req, res) => {
  const { invoiceId } = req.params;
  const result = await ZatcaServices.retryInvoice(invoiceId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: result.success,
    message: result.success ? 'Invoice resubmitted successfully' : 'Invoice resubmission failed',
    data: result.invoice,
  });
});

const retryAllPending = catchAsync(async (req, res) => {
  const branchId = (req.query.branchId as string) || 'MAIN-BRANCH';
  const result = await ZatcaServices.retryAllPending(branchId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Processed ${result.total} pending invoices (${result.succeeded} succeeded, ${result.failed} failed)`,
    data: result,
  });
});

const checkGatewayHealth = catchAsync(async (req, res) => {
  const env = req.query.environment as any;
  const result = await ZatcaServices.checkGatewayHealth(env);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ZATCA Gateway health checked',
    data: result,
  });
});

export const ZatcaController = {
  onboardDevice,
  processInvoice,
  getDeviceStatus,
  getInvoiceDetails,
  downloadXml,
  getAllInvoices,
  retryInvoice,
  retryAllPending,
  checkGatewayHealth,
};
