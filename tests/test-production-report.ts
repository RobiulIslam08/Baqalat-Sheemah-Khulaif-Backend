import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function testLiveProductionInvoice() {
  await mongoose.connect(process.env.DATABASE_URL!);
  const { ZatcaServices } = await import('../src/app/modules/Zatca/zatca.service');
  const { ZatcaConfig } = await import('../src/app/modules/Zatca/zatca.model');

  let cfg = await ZatcaConfig.findOne({ branchId: 'MAIN-BRANCH' });
  if (cfg && cfg.productionCsid && cfg.status !== 'onboarded') {
    cfg.status = 'onboarded';
    await cfg.save();
    cfg = await ZatcaConfig.findOne({ branchId: 'MAIN-BRANCH' });
  }
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

  console.log('\n--- Processing Live Production Standard Invoice (Clearance) ---');
  const stdNumber = `INV-STD-${Date.now()}`;
  try {
    const stdRes = await ZatcaServices.processInvoice({
      branchId: 'MAIN-BRANCH',
      invoiceNumber: stdNumber,
      invoiceType: 'standard',
      transactionType: 'invoice_388',
      customer: {
        name: 'Company Buyer Ltd',
        vatNumber: '310123456700003',
        crn: '1010123456',
        street: 'King Fahd Rd',
        buildingNumber: '1122',
        city: 'Riyadh',
        district: 'Al Olaya',
        postalCode: '12214',
        countryCode: 'SA',
      },
      items: [
        {
          name: 'Commercial Consulting',
          quantity: 1,
          unitPrice: 1000.0,
          vatRate: 15,
          vatCategory: 'S',
        },
      ],
      totalExclusiveVat: 1000.0,
      totalVatAmount: 150.0,
      totalInclusiveVat: 1150.0,
    });

    console.log('Standard Invoice processed:');
    console.log('Invoice Number:', stdRes.invoiceNumber);
    console.log('UUID:', stdRes.uuid);
    console.log('ZATCA Status:', stdRes.zatcaStatus);
    console.log('Validation Errors:', JSON.stringify(stdRes.validationErrors || []));
    console.log('Validation Warnings:', JSON.stringify(stdRes.validationWarnings || []));
  } catch (err: any) {
    console.error('Standard Invoice failed:', err?.message || err);
  }

  await mongoose.disconnect();
}

testLiveProductionInvoice().catch(console.error);
