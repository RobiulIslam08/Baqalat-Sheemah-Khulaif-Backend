import { ZatcaConfig, ZatcaInvoice } from '../zatca.model';
import { IZatcaInvoice } from '../zatca.interface';
import { ZatcaXmlGeneratorService, IInvoiceBuildData } from './zatcaXmlGenerator.service';
import { ZatcaSignerService } from './zatcaSigner.service';
import { ZatcaApiService } from './zatcaApi.service';
import AppError from '../../../errors/AppError';
import httpStatus from 'http-status';
import { randomUUID } from 'crypto';

export class ZatcaInvoiceProcessorService {
  protected xmlGenerator = new ZatcaXmlGeneratorService();
  protected signer = new ZatcaSignerService();

  /**
   * Process, generate, sign, and submit an invoice to ZATCA (Clearance or Reporting).
   */
  public async processSaleInvoice(
    saleData: IInvoiceBuildData & { branchId: string; saleId?: string },
    asyncReportForSimplified = false
  ): Promise<IZatcaInvoice> {
    const config = await ZatcaConfig.findOne({ branchId: saleData.branchId });
    if (!config || config.status !== 'onboarded') {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Branch [${saleData.branchId}] is not onboarded with ZATCA. Please complete onboarding first.`
      );
    }

    const isSandbox = config.environment === 'sandbox';
    const csidToUse = isSandbox
      ? (config.complianceCsid || config.productionCsid)
      : (config.productionCsid || config.complianceCsid);
    const secretToUse = isSandbox
      ? (config.complianceSecret || config.productionSecret)
      : (config.productionSecret || config.complianceSecret);

    if (!csidToUse || !secretToUse) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Missing ZATCA credentials for environment [${config.environment}]. Please onboard the device first.`
      );
    }

    // Determine ICV & PIH
    const latestInvoice = await ZatcaInvoice.findOne({ branchId: saleData.branchId })
      .sort({ icv: -1 })
      .lean();

    const icv = latestInvoice ? latestInvoice.icv + 1 : 1;
    // Official ZATCA standard initial PIH (Base64 of SHA-256 hex string of '0')
    const initialPih = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';
    const pih = latestInvoice ? latestInvoice.invoiceHash : initialPih;

    const uuid = saleData.uuid || randomUUID();
    saleData.uuid = uuid;

    // 1. Build raw UBL 2.1 XML
    const buildResult = this.xmlGenerator.buildInvoiceXml(saleData, config, icv, pih);

    // 2. Sign XML and generate Phase 2 TLV QR Code
    const signResult = this.signer.signInvoiceXml(
      buildResult.xml,
      config.privateKey,
      csidToUse
    );

    // 3. Create initial database record
    const invoiceDoc = new ZatcaInvoice({
      branchId: saleData.branchId,
      saleId: saleData.saleId,
      invoiceNumber: saleData.invoiceNumber,
      uuid,
      invoiceType: saleData.invoiceType,
      invoiceSubType: saleData.invoiceType === 'standard' ? '0100000' : '0200000',
      transactionType: saleData.transactionType || 'invoice_388',
      billingReferenceId: saleData.billingReferenceId,
      issueDatetime: saleData.issueDatetime ? new Date(saleData.issueDatetime) : new Date(),

      totalExclusiveVat: saleData.totalExclusiveVat,
      totalVatAmount: saleData.totalVatAmount,
      totalInclusiveVat: saleData.totalInclusiveVat,

      icv,
      pih,
      invoiceHash: signResult.invoiceHash,
      digitalSignature: signResult.signature,
      qrCodePayload: signResult.qrCodePayload,
      signedXml: signResult.signedXml,
      zatcaStatus: 'pending',
    });

    await invoiceDoc.save();

    const api = new ZatcaApiService(config.environment);

    // 4. Dispatch to ZATCA API
    if (isSandbox) {
      // In sandbox mode, submit to compliance/invoices for validation & reporting
      const compRes = await api.submitComplianceInvoice(
        csidToUse,
        secretToUse,
        signResult.invoiceHash,
        uuid,
        signResult.signedXml,
        saleData.invoiceType === 'standard'
      );

      invoiceDoc.rawZatcaResponse = compRes.data;
      if (compRes.validationResults?.warningMessages) {
        invoiceDoc.validationWarnings = compRes.validationResults.warningMessages;
      }
      if (compRes.validationResults?.errorMessages) {
        invoiceDoc.validationErrors = compRes.validationResults.errorMessages;
      }

      if (compRes.reportingStatus === 'REPORTED' || compRes.clearanceStatus === 'CLEARED' || compRes.success) {
        invoiceDoc.zatcaStatus = saleData.invoiceType === 'standard' ? 'cleared' : 'reported';
        invoiceDoc.clearedOrReportedAt = new Date();
      } else {
        invoiceDoc.zatcaStatus = 'failed';
      }

      await invoiceDoc.save();
    } else if (saleData.invoiceType === 'standard') {
      // B2B Standard: Real-time Clearance
      const clearanceResult = await api.clearInvoice(
        csidToUse,
        secretToUse,
        signResult.invoiceHash,
        uuid,
        signResult.signedXml
      );

      invoiceDoc.rawZatcaResponse = clearanceResult.data;
      if (clearanceResult.validationResults?.warningMessages) {
        invoiceDoc.validationWarnings = clearanceResult.validationResults.warningMessages;
      }
      if (clearanceResult.validationResults?.errorMessages) {
        invoiceDoc.validationErrors = clearanceResult.validationResults.errorMessages;
      }

      if (clearanceResult.clearanceStatus === 'CLEARED' && clearanceResult.clearedInvoice) {
        invoiceDoc.stampedXml = Buffer.from(clearanceResult.clearedInvoice, 'base64').toString('utf8');
        invoiceDoc.zatcaStatus = 'cleared';
        invoiceDoc.clearedOrReportedAt = new Date();
      } else {
        invoiceDoc.zatcaStatus = clearanceResult.success ? 'cleared' : 'rejected';
      }

      await invoiceDoc.save();
    } else {
      // B2C Simplified: Reporting within 24 hours
      if (!asyncReportForSimplified) {
        const reportingResult = await api.reportInvoice(
          csidToUse,
          secretToUse,
          signResult.invoiceHash,
          uuid,
          signResult.signedXml
        );

        invoiceDoc.rawZatcaResponse = reportingResult.data;
        if (reportingResult.validationResults?.warningMessages) {
          invoiceDoc.validationWarnings = reportingResult.validationResults.warningMessages;
        }
        if (reportingResult.validationResults?.errorMessages) {
          invoiceDoc.validationErrors = reportingResult.validationResults.errorMessages;
        }

        if (reportingResult.reportingStatus === 'REPORTED' || reportingResult.success) {
          invoiceDoc.zatcaStatus = 'reported';
          invoiceDoc.clearedOrReportedAt = new Date();
        } else {
          invoiceDoc.zatcaStatus = 'failed';
        }

        await invoiceDoc.save();
      }
    }

    return invoiceDoc;
  }
}
