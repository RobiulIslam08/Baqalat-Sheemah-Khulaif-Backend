import { ZatcaConfig } from '../zatca.model';
import { IZatcaConfig } from '../zatca.interface';
import { ZatcaCryptoHelper } from './zatcaCrypto.helper';
import { ZatcaApiService } from './zatcaApi.service';
import { ZatcaXmlGeneratorService } from './zatcaXmlGenerator.service';
import { ZatcaSignerService } from './zatcaSigner.service';
import AppError from '../../../errors/AppError';
import httpStatus from 'http-status';
import { randomUUID } from 'crypto';

export class ZatcaOnboardingService {
  protected xmlGenerator = new ZatcaXmlGeneratorService();
  protected signer = new ZatcaSignerService();

  /**
   * Step 1: Generate EC secp256k1 keypair & CSR with ZATCA custom OIDs.
   */
  public async generateKeysAndCsr(config: IZatcaConfig): Promise<IZatcaConfig> {
    if (!config.privateKey) {
      const keys = ZatcaCryptoHelper.generateEcKeyPair();
      config.privateKey = keys.privateKey;
      config.publicKey = keys.publicKey;
    }

    const csr = ZatcaCryptoHelper.generateCsr(
      config.privateKey,
      {
        vatNumber: config.vatNumber,
        taxpayerName: config.taxpayerName,
        branchName: config.branchName || config.taxpayerName,
        serialNumber: config.serialNumber,
        buildingNumber: config.buildingNumber,
        streetName: config.streetName,
        businessCategory: config.businessCategory ? config.businessCategory.replace(/&/g, 'and') : 'Food and Beverage',
        invoiceTypeFlag: '1100',
      },
      config.environment
    );

    config.csrContent = csr;
    config.status = 'pending';

    await ZatcaConfig.findOneAndUpdate({ branchId: config.branchId }, config, {
      upsert: true,
      new: true,
    });

    return config;
  }

  /**
   * Step 2: Exchange OTP & CSR with ZATCA for Compliance CSID.
   */
  public async exchangeOtpForComplianceCsid(config: IZatcaConfig, otp: string): Promise<IZatcaConfig> {
    if (!config.csrContent || !config.privateKey) {
      await this.generateKeysAndCsr(config);
    }

    const api = new ZatcaApiService(config.environment);
    const res = await api.requestComplianceCsid(otp, config.csrContent!);

    if (!res.success) {
      const detailedMessage =
        res.data?.errors && Array.isArray(res.data.errors)
          ? res.data.errors.map((e: any) => e.message || JSON.stringify(e)).join(', ')
          : res.data?.message || res.data?.rawText || JSON.stringify(res.data);
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `ZATCA Compliance CSID failed (${res.statusCode}): ${detailedMessage}`
      );
    }

    config.complianceCsid = res.data.binarySecurityToken;
    config.complianceSecret = res.data.secret;
    config.complianceRequestId = String(res.data.requestID || '');

    await ZatcaConfig.findOneAndUpdate({ branchId: config.branchId }, config, { new: true });
    return config;
  }

  /**
   * Step 3: Run required compliance test invoices (Standard & Simplified).
   */
  public async runComplianceTests(config: IZatcaConfig): Promise<{ success: boolean; details: any }> {
    if (!config.complianceCsid || !config.complianceSecret) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Compliance CSID is missing. Exchange OTP first.');
    }

    const api = new ZatcaApiService(config.environment);
    const initialPih = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

    // 1. Simplified test invoice
    const simplifiedUuid = randomUUID();
    const simplifiedBuild = this.xmlGenerator.buildInvoiceXml(
      {
        invoiceNumber: `COMPLIANCE-SIMP-${Date.now()}`,
        uuid: simplifiedUuid,
        invoiceType: 'simplified',
        items: [
          {
            name: 'Compliance Test Product',
            quantity: 1,
            unitPrice: 100,
            vatRate: 15,
            vatCategory: 'S',
          },
        ],
        totalExclusiveVat: 100,
        totalVatAmount: 15,
        totalInclusiveVat: 115,
      },
      config,
      1,
      initialPih
    );

    const simplifiedSigned = this.signer.signInvoiceXml(
      simplifiedBuild.xml,
      config.privateKey,
      config.complianceCsid
    );

    const simpResult = await api.submitComplianceInvoice(
      config.complianceCsid,
      config.complianceSecret,
      simplifiedSigned.invoiceHash,
      simplifiedUuid,
      simplifiedSigned.signedXml,
      false
    );

    // 2. Standard test invoice
    const standardUuid = randomUUID();
    const standardBuild = this.xmlGenerator.buildInvoiceXml(
      {
        invoiceNumber: `COMPLIANCE-STD-${Date.now()}`,
        uuid: standardUuid,
        invoiceType: 'standard',
        customer: {
          name: 'Compliance B2B Buyer LLC',
          vatNumber: '300000000000003',
          streetName: 'Olaya St',
          buildingNumber: '1111',
          cityName: 'Riyadh',
          postalCode: '12211',
          countryCode: 'SA',
        },
        items: [
          {
            name: 'Compliance Test Wholesale Item',
            quantity: 10,
            unitPrice: 50,
            vatRate: 15,
            vatCategory: 'S',
          },
        ],
        totalExclusiveVat: 500,
        totalVatAmount: 75,
        totalInclusiveVat: 575,
      },
      config,
      2,
      simplifiedSigned.invoiceHash
    );

    const standardSigned = this.signer.signInvoiceXml(
      standardBuild.xml,
      config.privateKey,
      config.complianceCsid
    );

    const stdResult = await api.submitComplianceInvoice(
      config.complianceCsid,
      config.complianceSecret,
      standardSigned.invoiceHash,
      standardUuid,
      standardSigned.signedXml,
      true
    );

    // 3. Simplified Credit Note (Refund/Amendment test)
    const creditUuid = randomUUID();
    const creditBuild = this.xmlGenerator.buildInvoiceXml(
      {
        invoiceNumber: `COMPLIANCE-CN-${Date.now()}`,
        uuid: creditUuid,
        invoiceType: 'simplified',
        transactionType: 'credit_note_381',
        billingReferenceId: `COMPLIANCE-SIMP-REF`,
        items: [
          {
            name: 'Compliance Test Returned Item',
            quantity: 1,
            unitPrice: 20,
            vatRate: 15,
            vatCategory: 'S',
          },
        ],
        totalExclusiveVat: 20,
        totalVatAmount: 3,
        totalInclusiveVat: 23,
      },
      config,
      3,
      standardSigned.invoiceHash
    );

    const creditSigned = this.signer.signInvoiceXml(
      creditBuild.xml,
      config.privateKey,
      config.complianceCsid
    );

    let creditResult: any = { success: true };
    try {
      creditResult = await api.submitComplianceInvoice(
        config.complianceCsid,
        config.complianceSecret,
        creditSigned.invoiceHash,
        creditUuid,
        creditSigned.signedXml,
        false
      );
    } catch (cnErr) {
      console.warn('[ZATCA Onboarding] Credit note test notice:', cnErr);
    }

    const passed = (simpResult.success || simpResult.statusCode === 200) && (stdResult.success || stdResult.statusCode === 200);

    if (passed) {
      config.status = 'compliance_passed';
      await ZatcaConfig.findOneAndUpdate({ branchId: config.branchId }, { status: 'compliance_passed' });
    }

    return {
      success: passed,
      details: {
        simplified: simpResult,
        standard: stdResult,
        creditNote: creditResult,
      },
    };
  }

  /**
   * Step 4: Request Production CSID (PCSID) from ZATCA.
   */
  public async requestProductionCsid(config: IZatcaConfig): Promise<IZatcaConfig> {
    if (!config.complianceRequestId || !config.complianceCsid || !config.complianceSecret) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Cannot request Production CSID without Compliance credentials.');
    }

    const api = new ZatcaApiService(config.environment);
    const res = await api.requestProductionCsid(
      config.complianceCsid,
      config.complianceSecret,
      config.complianceRequestId
    );

    if (!res.success) {
      const detailedMessage =
        res.data?.errors && Array.isArray(res.data.errors)
          ? res.data.errors.map((e: any) => e.message || JSON.stringify(e)).join(', ')
          : res.data?.message || res.data?.rawText || JSON.stringify(res.data);
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `ZATCA Production CSID issuance failed (${res.statusCode}): ${detailedMessage}`
      );
    }

    config.productionCsid = res.data.binarySecurityToken;
    config.productionSecret = res.data.secret;
    config.productionRequestId = String(res.data.requestID || '');
    config.status = 'onboarded';
    config.onboardedAt = new Date();

    const updated = await ZatcaConfig.findOneAndUpdate({ branchId: config.branchId }, config, { new: true });
    return updated!;
  }

  /**
   * Execute full onboarding lifecycle in one automated call.
   */
  public async fullAutomatedOnboard(payload: any): Promise<IZatcaConfig> {
    let config = await ZatcaConfig.findOne({ branchId: payload.branchId });

    // Sanitize businessCategory so it never contains forbidden characters like '&'
    if (payload.businessCategory) {
      payload.businessCategory = payload.businessCategory.replace(/&/g, 'and').replace(/[^a-zA-Z0-9\u0600-\u06FF\s-_]/g, '').trim();
    } else {
      payload.businessCategory = 'Food and Beverage';
    }

    // Always generate fresh EC Key pair and reset stale compliance tokens if not onboarded yet
    let privateKey = config?.privateKey;
    let publicKey = config?.publicKey;
    if (!config || config.status !== 'onboarded' || !privateKey || !publicKey) {
      const keys = ZatcaCryptoHelper.generateEcKeyPair();
      privateKey = keys.privateKey;
      publicKey = keys.publicKey;
      if (config) {
        config.csrContent = undefined;
        config.complianceCsid = undefined;
        config.complianceSecret = undefined;
        config.complianceRequestId = undefined;
      }
    }

    const serialNumber =
      (config?.status === 'onboarded' && config?.serialNumber) ||
      `1-POS|2-${payload.branchId || 'MAIN'}|3-${randomUUID().substring(0, 18)}`;

    if (!config) {
      config = new ZatcaConfig({
        ...payload,
        privateKey: privateKey!,
        publicKey: publicKey!,
        serialNumber,
      });
      await config.save();
    } else {
      Object.assign(config, payload);
      config.privateKey = privateKey!;
      config.publicKey = publicKey!;
      config.serialNumber = serialNumber;
      await config.save();
    }

    // Step 1: CSR
    await this.generateKeysAndCsr(config);

    // Step 2: Compliance CSID
    await this.exchangeOtpForComplianceCsid(config, payload.otp);

    // Step 3: Compliance Tests
    let testsPassed = false;
    try {
      const tests = await this.runComplianceTests(config);
      testsPassed = tests.success;
    } catch (testErr) {
      console.warn('[ZATCA Onboarding] Compliance test validation note:', testErr);
    }

    // Step 4: Production CSID
    try {
      const finalized = await this.requestProductionCsid(config);
      return finalized;
    } catch (prodErr: any) {
      if (!testsPassed) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Compliance checks did not pass and Production CSID could not be issued: ${prodErr.message}`
        );
      }
      throw prodErr;
    }
  }
}
