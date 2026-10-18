import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/sheemah_pos');
  const db = mongoose.connection.db!;
  const s = await db.collection('sales').findOne({ billNo: 8502 });
  console.log('Sale 8502 keys:', Object.keys(s || {}));
  console.log('Sale 8502 qrCodePayload:', s?.qrCodePayload ? s.qrCodePayload.substring(0, 50) : null);
  const z = await db.collection('zatcainvoices').findOne({ invoiceNumber: 'INV-8502' });
  console.log('Zatca 8502 qrCodePayload:', z?.qrCodePayload ? z.qrCodePayload.substring(0, 50) : null);
  await mongoose.disconnect();
}
run().catch(console.error);
