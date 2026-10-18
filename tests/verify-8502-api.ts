import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/sheemah_pos');
  const { SaleService } = await import('../src/app/modules/Sale/sale.service');
  const sale = await SaleService.getSaleByBillNo(8502);
  console.log('--- API getSaleByBillNo(8502) Result ---');
  console.log('billNo:', sale.billNo);
  console.log('has qrCodePayload:', !!sale.qrCodePayload);
  console.log('qrCodePayload length:', sale.qrCodePayload?.length);
  console.log('qrCodePayload snippet:', sale.qrCodePayload?.substring(0, 40));
  console.log('zatcaStatus:', sale.zatcaStatus);
  await mongoose.disconnect();
}
run().catch(console.error);
