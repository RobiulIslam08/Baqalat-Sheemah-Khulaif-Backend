import { ZatcaConfig } from '../src/app/modules/Zatca/zatca.model';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import * as crypto from 'crypto';
dotenv.config();

async function check() {
  await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/sheemah_pos');
  const cfg = await ZatcaConfig.findOne({ branchId: 'MAIN-BRANCH' });
  console.log('Config VAT in DB:', cfg?.vatNumber);

  // Inspect Compliance CSID
  const compUtf8 = Buffer.from(cfg!.complianceCsid!, 'base64').toString('utf8');
  const compDer = Buffer.from(compUtf8.replace(/\s+/g, ''), 'base64');
  const compCert = new crypto.X509Certificate(compDer);
  console.log('\n--- Compliance CSID ---');
  console.log('Subject:', compCert.subject);
  console.log('SubjectAltName:', compCert.subjectAltName);

  // Inspect Production CSID
  const prodUtf8 = Buffer.from(cfg!.productionCsid!, 'base64').toString('utf8');
  const prodDer = Buffer.from(prodUtf8.replace(/\s+/g, ''), 'base64');
  const prodCert = new crypto.X509Certificate(prodDer);
  console.log('\n--- Production CSID ---');
  console.log('Subject:', prodCert.subject);
  console.log('SubjectAltName:', prodCert.subjectAltName);

  await mongoose.disconnect();
}
check().catch(console.error);
