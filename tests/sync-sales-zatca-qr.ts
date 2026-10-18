import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/sheemah_pos');
  const db = mongoose.connection.db!;
  const zatcaInvs = await db.collection('zatcainvoices').find({ qrCodePayload: { $exists: true, $ne: '' } }).toArray();
  console.log(`Found ${zatcaInvs.length} ZATCA invoices with qrCodePayload.`);

  for (const z of zatcaInvs) {
    let billNo: number | undefined;
    if (z.invoiceNumber && z.invoiceNumber.startsWith('INV-')) {
      billNo = Number(z.invoiceNumber.replace('INV-', ''));
    }
    const filter: any = z.saleId ? { $or: [{ _id: z.saleId }, { billNo }] } : { billNo };
    const res = await db.collection('sales').updateMany(filter, {
      $set: {
        qrCodePayload: z.qrCodePayload,
        zatcaStatus: z.zatcaStatus,
      },
    });
    console.log(`Updated sale for ${z.invoiceNumber} (billNo: ${billNo}): matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  // Also check
  const sales = await db.collection('sales').find({}).sort({ billNo: -1 }).limit(5).toArray();
  for (const s of sales) {
    console.log(`Sale ${s.billNo} has qrCodePayload: ${!!s.qrCodePayload}, len: ${s.qrCodePayload?.length}`);
  }

  await mongoose.disconnect();
}
run().catch(console.error);
