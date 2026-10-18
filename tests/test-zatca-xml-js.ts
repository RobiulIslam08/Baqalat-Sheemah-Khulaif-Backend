import { ZatcaConfig } from '../src/app/modules/Zatca/zatca.model';
import { ZatcaApiService } from '../src/app/modules/Zatca/services/zatcaApi.service';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Require zatca-xml-js from scratch
const { ZATCASimplifiedTaxInvoice, ZATCAPaymentMethods, ZATCAInvoiceTypes } = require('C:/Users/User/.gemini/antigravity-ide/brain/76dc1054-faaa-4dd3-bfa6-5d207b00c4a7/scratch/package/lib/index');

async function testZatcaXmlJs() {
  await mongoose.connect(process.env.DATABASE_URL!);
  const cfg = await ZatcaConfig.findOne({ branchId: 'MAIN-BRANCH' });
  if (!cfg) throw new Error('No config');

  const invoice = new ZATCASimplifiedTaxInvoice({
    props: {
      egs_info: {
        uuid: require('crypto').randomUUID(),
        custom_id: `INV-${Date.now()}`,
        model: 'POS',
        CRN_number: cfg.crn || '7021959304',
        VAT_name: cfg.taxpayerName,
        VAT_number: cfg.vatNumber,
        branch_name: cfg.branchName || cfg.taxpayerName,
        branch_industry: cfg.businessCategory || 'Food and Beverage',
        location: {
          city: cfg.cityName || 'Al Khafji',
          city_subdivision: cfg.citySubdivision || 'hail st.',
          street: cfg.streetName || 'hail st.',
          plot_identification: '1234',
          building: cfg.buildingNumber || '8272',
          postal_zone: cfg.postalCode || '39261',
        },
      },
      invoice_counter_number: 1,
      invoice_serial_number: `INV-${Date.now()}`,
      issue_date: new Date().toISOString().split('T')[0],
      issue_time: new Date().toTimeString().split(' ')[0],
      previous_invoice_hash: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI4NjExN2Q5MTU0NWNmNEY=',
      line_items: [
        {
          id: '1',
          name: 'Fresh Milk',
          quantity: 2,
          tax_exclusive_price: 15,
          VAT_percent: 0.15,
          other_taxes: [],
          discounts: [],
        },
      ],
    },
  });

  console.log('Signing invoice with zatca-xml-js...');
  const { signed_invoice_string, invoice_hash, qr } = invoice.sign(
    cfg.complianceCsid!,
    cfg.privateKey!
  );

  console.log('Invoice hash:', invoice_hash);
  console.log('QR length:', qr.length);

  const api = new ZatcaApiService(cfg.environment as any);
  const uuid = invoice.getXML().get('Invoice/cbc:UUID')[0]['#text'];
  console.log('UUID:', uuid);

  console.log('Submitting to ZATCA Compliance API...');
  const res = await api.submitComplianceInvoice(
    cfg.complianceCsid!,
    cfg.complianceSecret!,
    invoice_hash,
    uuid,
    signed_invoice_string,
    false
  );

  console.log('Status Code:', res.statusCode);
  console.log('Success:', res.success);
  console.log('Validation Results:', JSON.stringify(res.validationResults, null, 2));

  await mongoose.disconnect();
}

testZatcaXmlJs().catch(console.error);
