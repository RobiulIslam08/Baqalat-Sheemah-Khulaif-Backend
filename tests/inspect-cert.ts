import mongoose from 'mongoose';
import dotenv from 'dotenv';
import * as crypto from 'crypto';
import { ZatcaConfig } from '../src/app/modules/Zatca/zatca.model';
import { ZatcaCryptoHelper } from '../src/app/modules/Zatca/services/zatcaCrypto.helper';
dotenv.config();

async function inspect() {
  await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/sheemah_pos');
  const cfg: any = await ZatcaConfig.findOne({ branchId: 'MAIN-BRANCH' });
  const certDetails = ZatcaCryptoHelper.extractCertificateDetails(cfg.complianceCsid);
  console.log('--- Issuer ---', certDetails.issuerName);
  console.log('--- Serial ---', certDetails.serialNumber);
  console.log('--- Public Key PEM ---', certDetails.publicKey);

  const x509 = new crypto.X509Certificate(certDetails.pem);
  console.log('--- X509 Subject ---', x509.subject);
  console.log('--- Subject Alt Name ---', x509.subjectAltName);

  // Check public key in SPKI DER format
  const spkiDer = x509.publicKey.export({ type: 'spki', format: 'der' });
  console.log('SPKI DER len:', spkiDer.length, 'hex:', spkiDer.toString('hex'));

  // Compare with privateKey public key
  const privKeyObj = crypto.createPrivateKey(cfg.privateKey);
  const privPubSpki = crypto.createPublicKey(privKeyObj).export({ type: 'spki', format: 'der' });
  console.log('Private key public SPKI len:', privPubSpki.length, 'hex:', privPubSpki.toString('hex'));
  console.log('Public keys match?', spkiDer.equals(privPubSpki));

  // Check last 65 bytes (uncompressed EC point 0x04 || X || Y)
  const raw65FromCert = spkiDer.subarray(spkiDer.length - 65);
  const raw65FromPriv = privPubSpki.subarray(privPubSpki.length - 65);
  console.log('Raw 65 match?', raw65FromCert.equals(raw65FromPriv));
  console.log('Raw 65 hex:', raw65FromCert.toString('hex'));

  await mongoose.disconnect();
}

inspect().catch(console.error);
