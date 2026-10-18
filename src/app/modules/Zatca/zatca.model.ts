import { Schema, model } from 'mongoose';
import { IZatcaConfig, IZatcaInvoice } from './zatca.interface';

const ZatcaConfigSchema = new Schema<IZatcaConfig>(
  {
    branchId: { type: String, required: true, unique: true, index: true },
    deviceName: { type: String, default: 'POS Terminal 01' },
    serialNumber: { type: String, required: true, unique: true },
    vatNumber: { type: String, required: true },
    taxpayerName: { type: String, required: true },
    branchName: { type: String },
    businessCategory: { type: String, default: 'Food and Beverage' },
    crn: { type: String },

    streetName: { type: String, required: true },
    buildingNumber: { type: String, required: true },
    citySubdivision: { type: String },
    cityName: { type: String, required: true },
    postalCode: { type: String, required: true },
    countryCode: { type: String, default: 'SA' },

    environment: {
      type: String,
      enum: ['sandbox', 'simulation', 'production'],
      default: 'sandbox',
    },
    privateKey: { type: String },
    publicKey: { type: String },
    csrContent: { type: String },

    complianceCsid: { type: String },
    complianceSecret: { type: String },
    complianceRequestId: { type: String },

    productionCsid: { type: String },
    productionSecret: { type: String },
    productionRequestId: { type: String },

    status: {
      type: String,
      enum: ['pending', 'compliance_passed', 'onboarded', 'expired'],
      default: 'pending',
    },
    onboardedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

const ZatcaInvoiceSchema = new Schema<IZatcaInvoice>(
  {
    branchId: { type: String, required: true, index: true },
    saleId: { type: Schema.Types.ObjectId, ref: 'Sale', index: true },
    invoiceNumber: { type: String, required: true, index: true },
    uuid: { type: String, required: true, unique: true },
    invoiceType: {
      type: String,
      enum: ['standard', 'simplified'],
      default: 'simplified',
    },
    invoiceSubType: { type: String, default: '0200000' },
    transactionType: {
      type: String,
      enum: ['invoice_388', 'credit_note_381', 'debit_note_383'],
      default: 'invoice_388',
    },
    billingReferenceId: { type: String },
    issueDatetime: { type: Date, required: true },

    totalExclusiveVat: { type: Number, required: true, default: 0 },
    totalVatAmount: { type: Number, required: true, default: 0 },
    totalInclusiveVat: { type: Number, required: true, default: 0 },

    icv: { type: Number, required: true },
    pih: { type: String, required: true },
    invoiceHash: { type: String, required: true },

    digitalSignature: { type: String },
    qrCodePayload: { type: String },

    signedXml: { type: String },
    stampedXml: { type: String },

    zatcaStatus: {
      type: String,
      enum: ['pending', 'cleared', 'reported', 'rejected', 'failed'],
      default: 'pending',
      index: true,
    },
    validationWarnings: { type: Schema.Types.Mixed },
    validationErrors: { type: Schema.Types.Mixed },
    rawZatcaResponse: { type: Schema.Types.Mixed },
    clearedOrReportedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

ZatcaInvoiceSchema.index({ branchId: 1, icv: -1 });

export const ZatcaConfig = model<IZatcaConfig>('ZatcaConfig', ZatcaConfigSchema);
export const ZatcaInvoice = model<IZatcaInvoice>('ZatcaInvoice', ZatcaInvoiceSchema);
