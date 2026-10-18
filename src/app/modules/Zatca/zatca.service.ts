import { ZatcaConfig, ZatcaInvoice } from './zatca.model';
import { ZatcaOnboardingService } from './services/zatcaOnboarding.service';
import { ZatcaInvoiceProcessorService } from './services/zatcaInvoiceProcessor.service';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

const onboardingService = new ZatcaOnboardingService();
const invoiceProcessor = new ZatcaInvoiceProcessorService();

const onboardDevice = async (payload: any) => {
  return await onboardingService.fullAutomatedOnboard(payload);
};

const processInvoice = async (payload: any) => {
  return await invoiceProcessor.processSaleInvoice(payload);
};

const getDeviceStatus = async (branchId: string) => {
  const config = await ZatcaConfig.findOne({ branchId });
  if (!config) {
    throw new AppError(httpStatus.NOT_FOUND, `No ZATCA configuration found for branch: ${branchId}`);
  }

  return {
    branchId: config.branchId,
    deviceName: config.deviceName,
    serialNumber: config.serialNumber,
    vatNumber: config.vatNumber,
    taxpayerName: config.taxpayerName,
    environment: config.environment,
    status: config.status,
    isFullyOnboarded: config.status === 'onboarded' && !!config.productionCsid,
    hasComplianceCsid: !!config.complianceCsid,
    onboardedAt: config.onboardedAt,
  };
};

const getInvoiceDetails = async (invoiceId: string) => {
  const filter: any = mongoose.Types.ObjectId.isValid(invoiceId)
    ? { $or: [{ _id: invoiceId }, { uuid: invoiceId }, { invoiceNumber: invoiceId }] }
    : { $or: [{ uuid: invoiceId }, { invoiceNumber: invoiceId }] };
  const invoice = await ZatcaInvoice.findOne(filter);

  if (!invoice) {
    throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found.');
  }

  return invoice;
};

const downloadXml = async (invoiceId: string) => {
  const filter: any = mongoose.Types.ObjectId.isValid(invoiceId)
    ? { $or: [{ _id: invoiceId }, { uuid: invoiceId }, { invoiceNumber: invoiceId }] }
    : { $or: [{ uuid: invoiceId }, { invoiceNumber: invoiceId }] };
  const invoice = await ZatcaInvoice.findOne(filter);

  if (!invoice) {
    throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found.');
  }

  const xmlContent = invoice.stampedXml || invoice.signedXml;
  if (!xmlContent) {
    throw new AppError(httpStatus.NOT_FOUND, 'XML content not found for this invoice.');
  }

  return {
    fileName: `${invoice.zatcaStatus === 'cleared' ? 'CLEARED_' : 'SIGNED_'}${invoice.invoiceNumber}.xml`,
    xmlContent,
  };
};

const getAllInvoices = async (query: Record<string, any>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  const filter: Record<string, any> = {};

  if (query.branchId) {
    filter.branchId = query.branchId;
  }

  if (query.status && query.status !== 'all') {
    filter.zatcaStatus = query.status;
  }

  if (query.invoiceType && query.invoiceType !== 'all') {
    filter.invoiceType = query.invoiceType;
  }

  if (query.startDate || query.endDate) {
    filter.issueDatetime = {};
    if (query.startDate) {
      filter.issueDatetime.$gte = new Date(query.startDate);
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      filter.issueDatetime.$lte = end;
    }
  }

  if (query.search) {
    const searchRegex = new RegExp(query.search, 'i');
    filter.$or = [
      { invoiceNumber: searchRegex },
      { uuid: searchRegex },
    ];
  }

  const invoices = await ZatcaInvoice.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await ZatcaInvoice.countDocuments(filter);

  // Compute aggregate stats across all invoices
  const allStats = await ZatcaInvoice.aggregate([
    {
      $group: {
        _id: '$zatcaStatus',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalInclusiveVat' },
        totalVat: { $sum: '$totalVatAmount' },
      },
    },
  ]);

  const stats = {
    total: 0,
    cleared: 0,
    reported: 0,
    pending: 0,
    failed: 0,
    totalAmount: 0,
    totalVat: 0,
  };

  allStats.forEach((st) => {
    stats.total += st.count;
    stats.totalAmount += st.totalAmount || 0;
    stats.totalVat += st.totalVat || 0;
    if (st._id === 'cleared') stats.cleared = st.count;
    if (st._id === 'reported') stats.reported = st.count;
    if (st._id === 'pending') stats.pending = st.count;
    if (st._id === 'failed' || st._id === 'rejected') stats.failed += st.count;
  });

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    stats,
    invoices,
  };
};

const retryInvoice = async (invoiceId: string) => {
  const filter: any = mongoose.Types.ObjectId.isValid(invoiceId)
    ? { $or: [{ _id: invoiceId }, { uuid: invoiceId }, { invoiceNumber: invoiceId }] }
    : { $or: [{ uuid: invoiceId }, { invoiceNumber: invoiceId }] };
  const invoice = await ZatcaInvoice.findOne(filter);

  if (!invoice) {
    throw new AppError(httpStatus.NOT_FOUND, 'Invoice not found.');
  }

  if (invoice.zatcaStatus === 'cleared' || invoice.zatcaStatus === 'reported') {
    return {
      success: true,
      message: `Invoice is already successfully ${invoice.zatcaStatus}.`,
      invoice,
    };
  }

  const config = await ZatcaConfig.findOne({ branchId: invoice.branchId });
  if (!config || config.status !== 'onboarded') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Active ZATCA configuration missing for this branch.');
  }

  const isSandbox = config.environment === 'sandbox';
  const csidToUse = isSandbox ? (config.complianceCsid || config.productionCsid) : config.productionCsid;
  const secretToUse = isSandbox ? (config.complianceSecret || config.productionSecret) : config.productionSecret;

  if (!csidToUse || !secretToUse) {
    throw new AppError(httpStatus.BAD_REQUEST, `Credentials missing for environment [${config.environment}].`);
  }

  const { ZatcaApiService } = await import('./services/zatcaApi.service');
  const { ZatcaXmlGeneratorService } = await import('./services/zatcaXmlGenerator.service');
  const { ZatcaSignerService } = await import('./services/zatcaSigner.service');

  const api = new ZatcaApiService(config.environment);
  const xmlGen = new ZatcaXmlGeneratorService();
  const signer = new ZatcaSignerService();

  // Re-generate and sign with latest compliant schema & C14N
  const invoiceData: any = {
    invoiceNumber: invoice.invoiceNumber,
    uuid: invoice.uuid,
    invoiceType: invoice.invoiceType,
    transactionType: invoice.transactionType,
    billingReferenceId: invoice.billingReferenceId,
    issueDatetime: invoice.issueDatetime,
    totalExclusiveVat: invoice.totalExclusiveVat,
    totalVatAmount: invoice.totalVatAmount,
    totalInclusiveVat: invoice.totalInclusiveVat,
    items: [
      {
        name: 'مبيعات المنتجات والسلع',
        quantity: 1,
        unitPrice: invoice.totalExclusiveVat,
        vatRate: 15,
        vatCategory: 'S',
      },
    ],
  };

  if (invoice.saleId && mongoose.Types.ObjectId.isValid(String(invoice.saleId))) {
    try {
      const { Sale } = await import('../Sale/sale.model');
      const originalSale: any = await Sale.findById(String(invoice.saleId)).lean();
      if (originalSale && Array.isArray(originalSale.items) && originalSale.items.length > 0) {
        const vatRate = Number(originalSale.vatPercent) || 15;
        invoiceData.items = originalSale.items.map((it: any) => ({
          name: it.productName || 'منتج',
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.price) || 0,
          discount: 0,
          vatRate,
          vatCategory: 'S',
          unitCode: it.type === 'BOX' ? 'BOX' : 'PCE',
        }));
      }
    } catch {
      // fallback to default single aggregated line
    }
  }

  const build = xmlGen.buildInvoiceXml(invoiceData, config, invoice.icv, invoice.pih);
  const signResult = signer.signInvoiceXml(build.xml, config.privateKey, csidToUse);

  invoice.invoiceHash = signResult.invoiceHash;
  invoice.digitalSignature = signResult.signature;
  invoice.qrCodePayload = signResult.qrCodePayload;
  invoice.signedXml = signResult.signedXml;

  if (isSandbox) {
    const compRes = await api.submitComplianceInvoice(
      csidToUse,
      secretToUse,
      signResult.invoiceHash,
      invoice.uuid,
      signResult.signedXml,
      invoice.invoiceType === 'standard'
    );

    invoice.rawZatcaResponse = compRes.data;
    if (compRes.validationResults?.warningMessages) {
      invoice.validationWarnings = compRes.validationResults.warningMessages;
    }
    if (compRes.validationResults?.errorMessages) {
      invoice.validationErrors = compRes.validationResults.errorMessages;
    }

    if (compRes.reportingStatus === 'REPORTED' || compRes.clearanceStatus === 'CLEARED' || compRes.success) {
      invoice.zatcaStatus = invoice.invoiceType === 'standard' ? 'cleared' : 'reported';
      invoice.clearedOrReportedAt = new Date();
    } else {
      invoice.zatcaStatus = 'failed';
    }

    await invoice.save();
    return { success: invoice.zatcaStatus === 'reported' || invoice.zatcaStatus === 'cleared', invoice };
  } else if (invoice.invoiceType === 'standard') {
    const clearanceRes = await api.clearInvoice(
      csidToUse,
      secretToUse,
      signResult.invoiceHash,
      invoice.uuid,
      signResult.signedXml
    );

    invoice.rawZatcaResponse = clearanceRes.data;
    if (clearanceRes.validationResults?.warningMessages) {
      invoice.validationWarnings = clearanceRes.validationResults.warningMessages;
    }
    if (clearanceRes.validationResults?.errorMessages) {
      invoice.validationErrors = clearanceRes.validationResults.errorMessages;
    }

    if (clearanceRes.clearanceStatus === 'CLEARED' && clearanceRes.clearedInvoice) {
      invoice.stampedXml = Buffer.from(clearanceRes.clearedInvoice, 'base64').toString('utf8');
      invoice.zatcaStatus = 'cleared';
      invoice.clearedOrReportedAt = new Date();
    } else {
      invoice.zatcaStatus = clearanceRes.success ? 'cleared' : 'rejected';
    }

    await invoice.save();
    return { success: invoice.zatcaStatus === 'cleared', invoice };
  } else {
    const reportRes = await api.reportInvoice(
      csidToUse,
      secretToUse,
      signResult.invoiceHash,
      invoice.uuid,
      signResult.signedXml
    );

    invoice.rawZatcaResponse = reportRes.data;
    if (reportRes.validationResults?.warningMessages) {
      invoice.validationWarnings = reportRes.validationResults.warningMessages;
    }
    if (reportRes.validationResults?.errorMessages) {
      invoice.validationErrors = reportRes.validationResults.errorMessages;
    }

    if (reportRes.reportingStatus === 'REPORTED' || reportRes.success) {
      invoice.zatcaStatus = 'reported';
      invoice.clearedOrReportedAt = new Date();
    } else {
      invoice.zatcaStatus = 'failed';
    }

    await invoice.save();
    return { success: invoice.zatcaStatus === 'reported', invoice };
  }
};

const retryAllPending = async (branchId = 'MAIN-BRANCH') => {
  const pendingInvoices = await ZatcaInvoice.find({
    branchId,
    zatcaStatus: { $in: ['pending', 'failed', 'rejected'] },
  }).sort({ createdAt: 1 }).limit(50);

  if (pendingInvoices.length === 0) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      message: 'No pending or failed invoices found to retry.',
      results: [],
    };
  }

  let succeeded = 0;
  let failed = 0;
  const results: Array<{ invoiceNumber: string; success: boolean; error?: string }> = [];

  for (const inv of pendingInvoices) {
    try {
      const res = await retryInvoice(inv._id.toString());
      if (res.success) {
        succeeded++;
        results.push({ invoiceNumber: inv.invoiceNumber, success: true });
      } else {
        failed++;
        results.push({ invoiceNumber: inv.invoiceNumber, success: false });
      }
    } catch (err: any) {
      failed++;
      results.push({ invoiceNumber: inv.invoiceNumber, success: false, error: err?.message || 'Error retrying invoice' });
    }
  }

  return {
    total: pendingInvoices.length,
    succeeded,
    failed,
    results,
  };
};

const checkGatewayHealth = async (environment?: 'sandbox' | 'simulation' | 'production') => {
  const activeConfig = await ZatcaConfig.findOne({ status: 'onboarded' });
  const env = environment || activeConfig?.environment || 'sandbox';

  const endpoints = {
    sandbox: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
    simulation: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
    production: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
  };

  const targetUrl = endpoints[env];
  let isOnline = false;
  let responseTime = 0;

  try {
    const start = Date.now();
    const res = await fetch(targetUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    responseTime = Date.now() - start;
    isOnline = res.status < 500;
  } catch {
    isOnline = false;
  }

  return {
    environment: env,
    targetUrl,
    isOnline,
    responseTimeMs: responseTime,
    timestamp: new Date().toISOString(),
    isBranchOnboarded: !!activeConfig?.productionCsid,
  };
};

export const ZatcaServices = {
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
