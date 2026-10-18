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
    let prevHash = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI4NjExN2Q5MTU0NWNmNEY=';
    let icv = 1;

    const standardCustomer = {
      name: 'Compliance B2B Buyer LLC',
      vatNumber: '300000000000003',
      streetName: 'Olaya St',
      buildingNumber: '1234',
      citySubdivision: 'Al-Olaya',
      cityName: 'Riyadh',
      postalCode: '12211',
      countryCode: 'SA',
    };

    const steps = [
      {
        key: 'simplifiedInvoice',
        name: 'Simplified Invoice (388)',
        invoiceType: 'simplified' as const,
        transactionType: 'invoice_388' as const,
        clearance: false,
      },
      {
        key: 'simplifiedCreditNote',
        name: 'Simplified Credit Note (381)',
        invoiceType: 'simplified' as const,
        transactionType: 'credit_note_381' as const,
        clearance: false,
        billingReferenceId: 'COMPLIANCE-SIMP-REF',
      },
      {
        key: 'simplifiedDebitNote',
        name: 'Simplified Debit Note (383)',
        invoiceType: 'simplified' as const,
        transactionType: 'debit_note_383' as const,
        clearance: false,
        billingReferenceId: 'COMPLIANCE-SIMP-REF',
      },
      {
        key: 'standardInvoice',
        name: 'Standard Invoice (388)',
        invoiceType: 'standard' as const,
        transactionType: 'invoice_388' as const,
        clearance: true,
        customer: standardCustomer,
      },
      {
        key: 'standardCreditNote',
        name: 'Standard Credit Note (381)',
        invoiceType: 'standard' as const,
        transactionType: 'credit_note_381' as const,
        clearance: true,
        customer: standardCustomer,
        billingReferenceId: 'COMPLIANCE-STD-REF',
      },
      {
        key: 'standardDebitNote',
        name: 'Standard Debit Note (383)',
        invoiceType: 'standard' as const,
        transactionType: 'debit_note_383' as const,
        clearance: true,
        customer: standardCustomer,
        billingReferenceId: 'COMPLIANCE-STD-REF',
      },
    ];

    const results: Record<string, any> = {};
    let allPassed = true;

    for (const step of steps) {
      const stepUuid = randomUUID();
      const stepBuild = this.xmlGenerator.buildInvoiceXml(
        {
          invoiceNumber: `COMP-${Date.now()}-${icv}`,
          uuid: stepUuid,
          invoiceType: step.invoiceType,
          transactionType: step.transactionType,
          billingReferenceId: (step as any).billingReferenceId,
          customer: (step as any).customer,
          items: [
            {
              name: 'Compliance Test Product',
              quantity: 2,
              unitPrice: 25,
              vatRate: 15,
              vatCategory: 'S',
            },
          ],
          totalExclusiveVat: 50,
          totalVatAmount: 7.5,
          totalInclusiveVat: 57.5,
        },
        config,
        icv++,
        prevHash
      );

      const signed = this.signer.signInvoiceXml(
        stepBuild.xml,
        config.privateKey!,
        config.complianceCsid!
      );
      prevHash = signed.invoiceHash;

      let stepResult: any;
      try {
        stepResult = await api.submitComplianceInvoice(
          config.complianceCsid!,
          config.complianceSecret!,
          signed.invoiceHash,
          stepUuid,
          signed.signedXml,
          step.clearance
        );
      } catch (err: any) {
        stepResult = { success: false, error: err?.message || err };
      }

      results[step.key] = stepResult;

      const isPass =
        stepResult.success ||
        stepResult.statusCode === 200 ||
        stepResult.rawBody?.includes('already completed') ||
        stepResult.data?.message?.includes('already completed') ||
        (Array.isArray(stepResult.data?.errors) &&
          stepResult.data.errors.some((e: any) => e.message?.includes('already completed')));

      if (!isPass) {
        allPassed = false;
        console.warn(`[ZATCA Onboarding] Compliance step ${step.name} did not pass:`, stepResult);
      }
    }

    if (allPassed) {
      config.status = 'compliance_passed';
      await ZatcaConfig.findOneAndUpdate({ branchId: config.branchId }, { status: 'compliance_passed' });
    }

    return {
      success: allPassed,
      details: results,
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
