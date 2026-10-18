import { ZatcaInvoice, ZatcaConfig } from '../src/app/modules/Zatca/zatca.model';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

async function checkInvoice() {
  await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/sheemah_pos');
  const inv = await ZatcaInvoice.findOne({ invoiceNumber: 'INV-8502' });
  console.log('Invoice found:', !!inv);
  if (inv) {
    console.log('Invoice number:', inv.invoiceNumber);
    console.log('Zatca status:', inv.zatcaStatus);
    console.log('Errors count:', inv.validationErrors?.length);
    console.log('Raw response:', JSON.stringify(inv.rawZatcaResponse, null, 2));
    if (inv.signedXml) {
      fs.writeFileSync('tests/inv-8502-signed.xml', inv.signedXml);
      console.log('Saved signed XML to tests/inv-8502-signed.xml');
    }
  }

  const config = await ZatcaConfig.findOne({ branchId: 'MAIN-BRANCH' });
  console.log('\n--- ZatcaConfig ---');
  console.log('Config branchId:', config?.branchId);
  console.log('Config status:', config?.status);
  console.log('Config VAT:', config?.vatNumber);
  console.log('Compliance CSID length:', config?.complianceCsid?.length);
  console.log('Production CSID length:', config?.productionCsid?.length);
  console.log('Production CSID first 60 chars:', config?.productionCsid?.substring(0, 60));
  console.log('Production Secret length:', config?.productionSecret?.length);

  await mongoose.disconnect();
}
checkInvoice().catch(console.error);
