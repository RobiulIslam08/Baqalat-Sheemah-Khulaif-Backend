import { ZatcaConfig } from '../src/app/modules/Zatca/zatca.model';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import * as crypto from 'crypto';
dotenv.config();

async function check() {
  await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/sheemah_pos');
  const cfg = await ZatcaConfig.findOne({ branchId: 'MAIN-BRANCH' });

  // 1. Public key from private key
  const privObj = crypto.createPrivateKey(cfg!.privateKey);
  const pubFromPriv = crypto.createPublicKey(privObj).export({ type: 'spki', format: 'der' });
  const rawFromPriv = pubFromPriv.subarray(pubFromPriv.length - 65);

  // 2. Public key from Compliance CSID
  const compUtf8 = Buffer.from(cfg!.complianceCsid!, 'base64').toString('utf8');
  const compDer = Buffer.from(compUtf8.replace(/\s+/g, ''), 'base64');
  const compCert = new crypto.X509Certificate(compDer);
  const pubFromComp = compCert.publicKey.export({ type: 'spki', format: 'der' });
  const rawFromComp = pubFromComp.subarray(pubFromComp.length - 65);

  console.log('Match private key <-> compliance CSID public key:', rawFromPriv.equals(rawFromComp));

  // 3. Public key from Production CSID
  const prodUtf8 = Buffer.from(cfg!.productionCsid!, 'base64').toString('utf8');
  const prodDer = Buffer.from(prodUtf8.replace(/\s+/g, ''), 'base64');
  const prodCert = new crypto.X509Certificate(prodDer);
  const pubFromProd = prodCert.publicKey.export({ type: 'spki', format: 'der' });
  const rawFromProd = pubFromProd.subarray(pubFromProd.length - 65);

  console.log('Match private key <-> production CSID public key:', rawFromPriv.equals(rawFromProd));

  await mongoose.disconnect();
}
check().catch(console.error);
