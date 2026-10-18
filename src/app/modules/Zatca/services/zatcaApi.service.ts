import AppError from '../../../errors/AppError';
import httpStatus from 'http-status';

export interface IZatcaApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  data: T;
  rawBody: string;
  validationResults?: {
    infoMessages?: Array<{ code: string; message: string; category?: string }>;
    warningMessages?: Array<{ code: string; message: string; category?: string }>;
    errorMessages?: Array<{ code: string; message: string; category?: string }>;
    status?: string;
  };
  clearanceStatus?: string;
  reportingStatus?: string;
  clearedInvoice?: string;
}

export class ZatcaApiService {
  protected environment: 'sandbox' | 'simulation' | 'production';
  protected baseUrl: string;
  protected apiVersion = 'V2';

  constructor(environment: 'sandbox' | 'simulation' | 'production' = 'sandbox') {
    this.environment = environment;

    const endpoints = {
      sandbox: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
      simulation: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
      production: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
    };

    this.baseUrl = endpoints[environment] || endpoints.sandbox;
  }

  /**
   * Request Compliance CSID (CCSID) using 6-digit OTP and CSR.
   */
  public async requestComplianceCsid(otp: string, csrPem: string): Promise<IZatcaApiResponse> {
    const csrBase64 = Buffer.from(csrPem).toString('base64');

    const url = `${this.baseUrl}/compliance`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        OTP: otp,
        'Accept-Version': this.apiVersion,
        'Accept-Language': 'en',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        csr: csrBase64,
      }),
    });

    return this.parseResponse(res);
  }

  /**
   * Submit sample invoice to Compliance API for testing compliance checks.
   */
  public async submitComplianceInvoice(
    complianceToken: string,
    complianceSecret: string,
    invoiceHash: string,
    uuid: string,
    signedXml: string,
    isStandardInvoice = false
  ): Promise<IZatcaApiResponse> {
    const url = `${this.baseUrl}/compliance/invoices`;
    const authHeader = `Basic ${Buffer.from(`${complianceToken}:${complianceSecret}`).toString('base64')}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Accept-Version': this.apiVersion,
        'Accept-Language': 'en',
        'Clearance-Status': isStandardInvoice ? '1' : '0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceHash,
        uuid,
        invoice: Buffer.from(signedXml).toString('base64'),
      }),
    });

    return this.parseResponse(res);
  }

  /**
   * Request Production CSID (PCSID) after passing compliance test checks.
   */
  public async requestProductionCsid(
    complianceToken: string,
    complianceSecret: string,
    complianceRequestId: string
  ): Promise<IZatcaApiResponse> {
    const url = `${this.baseUrl}/production/csids`;
    const authHeader = `Basic ${Buffer.from(`${complianceToken}:${complianceSecret}`).toString('base64')}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Accept-Version': this.apiVersion,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        compliance_request_id: complianceRequestId,
      }),
    });

    return this.parseResponse(res);
  }

  /**
   * Submit Standard Invoice (B2B) for Real-Time Clearance.
   */
  public async clearInvoice(
    productionToken: string,
    productionSecret: string,
    invoiceHash: string,
    uuid: string,
    signedXml: string
  ): Promise<IZatcaApiResponse> {
    const url = `${this.baseUrl}/invoices/clearance/single`;
    const authHeader = `Basic ${Buffer.from(`${productionToken}:${productionSecret}`).toString('base64')}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Accept-Version': this.apiVersion,
        'Accept-Language': 'en',
        'Clearance-Status': '1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceHash,
        uuid,
        invoice: Buffer.from(signedXml).toString('base64'),
      }),
    });

    return this.parseResponse(res);
  }

  /**
   * Submit Simplified Invoice (B2C) for 24-Hour Reporting.
   */
  public async reportInvoice(
    productionToken: string,
    productionSecret: string,
    invoiceHash: string,
    uuid: string,
    signedXml: string
  ): Promise<IZatcaApiResponse> {
    const url = `${this.baseUrl}/invoices/reporting/single`;
    const authHeader = `Basic ${Buffer.from(`${productionToken}:${productionSecret}`).toString('base64')}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Accept-Version': this.apiVersion,
        'Accept-Language': 'en',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceHash,
        uuid,
        invoice: Buffer.from(signedXml).toString('base64'),
      }),
    });

    return this.parseResponse(res);
  }

  private async parseResponse(res: Response): Promise<IZatcaApiResponse> {
    const rawBody = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = { rawText: rawBody };
    }

    const success = res.status >= 200 && res.status < 300;

    return {
      success,
      statusCode: res.status,
      data,
      rawBody,
      validationResults: data?.validationResults,
      clearanceStatus: data?.clearanceStatus,
      reportingStatus: data?.reportingStatus,
      clearedInvoice: data?.clearedInvoice,
    };
  }
}
