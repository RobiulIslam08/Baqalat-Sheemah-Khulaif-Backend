import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/sheemah_pos');
  const db = mongoose.connection.db!;
  const sales = await db.collection('sales').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  console.log('--- LATEST SALES IN DB ---');
  for (const s of sales) {
    console.log(
      `Sale billNo: ${s.billNo}, id: ${s._id}, has qrCodePayload: ${!!s.qrCodePayload}, len: ${s.qrCodePayload?.length || 0}, zatcaStatus: ${s.zatcaStatus}`
    );
  }
  const zatcaInvs = await db.collection('zatcainvoices').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  console.log('\n--- LATEST ZATCA INVOICES IN DB ---');
  for (const z of zatcaInvs) {
    console.log(
      `Zatca inv: ${z.invoiceNumber}, id: ${z._id}, has qrCodePayload: ${!!z.qrCodePayload}, len: ${z.qrCodePayload?.length || 0}, status: ${z.zatcaStatus}, saleId: ${z.saleId}`
    );
  }
  await mongoose.disconnect();
}
run().catch(console.error);
