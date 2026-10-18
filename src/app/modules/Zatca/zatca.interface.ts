import { Types } from 'mongoose';

export type TZatcaEnvironment = 'sandbox' | 'simulation' | 'production';
export type TZatcaConfigStatus = 'pending' | 'compliance_passed' | 'onboarded' | 'expired';
export type TInvoiceType = 'standard' | 'simplified';
export type TTransactionType = 'invoice_388' | 'credit_note_381' | 'debit_note_383';
export type TZatcaInvoiceStatus = 'pending' | 'cleared' | 'reported' | 'rejected' | 'failed';

export interface IZatcaConfig {
  branchId: string;
  deviceName: string;
  serialNumber: string; // e.g. 1-POS|2-BRANCH|3-DEVICE
  vatNumber: string; // 15-digit Tax Identification Number starting and ending with 3
  taxpayerName: string;
  branchName?: string;
  businessCategory: string;
  crn?: string;

  // Physical Address
  streetName: string;
  buildingNumber: string;
  citySubdivision?: string;
  cityName: string;
  postalCode: string;
  countryCode: string;

  // Environment & Keys
  environment: TZatcaEnvironment;
  privateKey: string;
  publicKey?: string;
  csrContent?: string;

  // Compliance CSID (CCSID)
  complianceCsid?: string;
  complianceSecret?: string;
  complianceRequestId?: string;

  // Production CSID (PCSID)
  productionCsid?: string;
  productionSecret?: string;
  productionRequestId?: string;

  status: TZatcaConfigStatus;
  onboardedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IZatcaCustomer {
  name: string;
  vatNumber?: string;
  crn?: string;
  streetName?: string;
  buildingNumber?: string;
  citySubdivision?: string;
  cityName?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface IZatcaInvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  vatRate?: number;
  vatCategory?: 'S' | 'Z' | 'E' | 'O';
  unitCode?: string;
}

export interface IZatcaInvoice {
  branchId: string;
  saleId?: Types.ObjectId | string;
  invoiceNumber: string;
  uuid: string;
  invoiceType: TInvoiceType;
  invoiceSubType: string; // '0100000' or '0200000'
  transactionType: TTransactionType;
  billingReferenceId?: string;
  issueDatetime: Date;
  
  totalExclusiveVat: number;
  totalVatAmount: number;
  totalInclusiveVat: number;

  icv: number; // Invoice Counter Value
  pih: string; // Previous Invoice Hash (Base64 SHA-256)
  invoiceHash: string; // Current Invoice Canonical Hash
  
  digitalSignature?: string;
  qrCodePayload?: string; // Phase 2 TLV Base64
  
  signedXml?: string;
  stampedXml?: string; // Stamped XML returned by ZATCA for B2B

  zatcaStatus: TZatcaInvoiceStatus;
  validationWarnings?: Array<{ code: string; message: string; category?: string }>;
  validationErrors?: Array<{ code: string; message: string; category?: string }>;
  rawZatcaResponse?: Record<string, unknown>;
  clearedOrReportedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}
