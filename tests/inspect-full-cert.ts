import { ZatcaConfig } from '../src/app/modules/Zatca/zatca.model';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import * as crypto from 'crypto';
dotenv.config();

async function inspectFullCert() {
  await mongoose.connect(process.env.DATABASE_URL || '');
  const cfg = await ZatcaConfig.findOne({ branchId: 'MAIN-BRANCH' });
  const rawToken = cfg!.complianceCsid!;

  let decoded = Buffer.from(rawToken, 'base64').toString('utf8');
  let cleanB64 = '';
  if (decoded.startsWith('MI')) {
    cleanB64 = decoded;
  } else {
    cleanB64 = rawToken;
  }
  cleanB64 = cleanB64.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s+/g, '');

  const der = Buffer.from(cleanB64, 'base64');
  const cert = new crypto.X509Certificate(der);

  console.log('Subject:', cert.subject);
  console.log('Issuer:', cert.issuer);
  console.log('Raw Issuer Name:', cert.issuer);
  console.log('Serial Number:', cert.serialNumber);
  console.log('Valid From:', cert.validFrom);
  console.log('Valid To:', cert.validTo);

  // Compare cert.raw with der
  console.log('der length:', der.length);
  console.log('cert.raw length:', cert.raw.length);
  console.log('SHA-256 of der:', crypto.createHash('sha256').update(der).digest('base64'));
  console.log('SHA-256 of cert.raw:', crypto.createHash('sha256').update(cert.raw).digest('base64'));

  // Hex sha256 base64
  const hex = crypto.createHash('sha256').update(der).digest('hex');
  console.log('Hex sha256 base64:', Buffer.from(hex).toString('base64'));

  process.exit(0);
}

inspectFullCert().catch(console.error);
