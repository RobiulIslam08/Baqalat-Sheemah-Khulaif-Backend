import { ZatcaConfig } from '../src/app/modules/Zatca/zatca.model';
import { ZatcaCryptoHelper } from '../src/app/modules/Zatca/services/zatcaCrypto.helper';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  await mongoose.connect(process.env.DATABASE_URL || '');
  const cfg = await ZatcaConfig.findOne({ branchId: 'MAIN-BRANCH' });
  const details = ZatcaCryptoHelper.extractCertificateDetails(cfg!.complianceCsid!);
  console.log('--- Extracted Details ---');
  console.log('certDigest:', details.certDigest);
  console.log('issuerName:', details.issuerName);
  console.log('serialNumber:', details.serialNumber);
  console.log('pem starts with:', details.pem.slice(0, 40));
  process.exit(0);
}
check().catch(console.error);
