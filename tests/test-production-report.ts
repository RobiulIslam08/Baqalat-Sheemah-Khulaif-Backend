import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function testLiveProductionInvoice() {
  await mongoose.connect(process.env.DATABASE_URL!);
  const { ZatcaServices } = await import('../src/app/modules/Zatca/zatca.service');
  const { ZatcaConfig } = await import('../src/app/modules/Zatca/zatca.model');

  const cfg = await ZatcaConfig.findOne({ branchId: 'MAIN-BRANCH' });
  console.log('--- Current ZATCA Config ---');
  console.log('Environment:', cfg?.environment);
  console.log('Status:', cfg?.status);
  console.log('Has Production CSID:', !!cfg?.productionCsid);
  console.log('Has Production Secret:', !!cfg?.productionSecret);

  console.log('\n--- Processing Live Production Simplified Invoice ---');
  const invNumber = `INV-LIVE-${Date.now()}`;
  try {
    const res = await ZatcaServices.processInvoice({
      branchId: 'MAIN-BRANCH',
      invoiceNumber: invNumber,
      invoiceType: 'simplified',
      transactionType: 'invoice_388',
      items: [
        {
          name: 'بسكويت شاي 100 جم',
          quantity: 2,
          unitPrice: 5.0,
          vatRate: 15,
          vatCategory: 'S',
        },
      ],
      totalExclusiveVat: 10.0,
      totalVatAmount: 1.5,
      totalInclusiveVat: 11.5,
    });

    console.log('Invoice processed successfully:');
    console.log('Invoice Number:', res.invoiceNumber);
    console.log('UUID:', res.uuid);
    console.log('ZATCA Status:', res.zatcaStatus);
    console.log('QR Code Length:', res.qrCodePayload?.length);
    console.log('Validation Errors:', JSON.stringify(res.validationErrors || []));
    console.log('Validation Warnings:', JSON.stringify(res.validationWarnings || []));
  } catch (err: any) {
    console.error('Invoice processing failed:', err?.message || err);
  }

  await mongoose.disconnect();
}

testLiveProductionInvoice().catch(console.error);
