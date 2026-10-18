const mongoose = require('mongoose');
require('dotenv').config();
const { Certificate } = require('@fidm/x509');

async function test() {
  await mongoose.connect(process.env.DATABASE_URL);
  const db = mongoose.connection.db;
  const cfg = await db.collection('zatcaconfigs').findOne({ branchId: 'MAIN-BRANCH' });
  
  let clean = cfg.productionCsid.trim();
  let decodedUtf8 = '';
  try {
    decodedUtf8 = Buffer.from(clean, 'base64').toString('utf8');
  } catch {}

  let pem = '';
  if (clean.includes('-----BEGIN CERTIFICATE-----')) {
    pem = clean;
  } else if (decodedUtf8.includes('-----BEGIN CERTIFICATE-----')) {
    pem = decodedUtf8;
  } else if (decodedUtf8.startsWith('MII') || (decodedUtf8.length > 50 && /^[A-Za-z0-9+/=\r\n]+$/.test(decodedUtf8))) {
    const cleanInner = decodedUtf8.replace(/\s+/g, '');
    pem = `-----BEGIN CERTIFICATE-----\n${cleanInner.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
  } else {
    const cleanSingle = clean.replace(/\s+/g, '');
    pem = `-----BEGIN CERTIFICATE-----\n${cleanSingle.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
  }

  console.log('PEM formatted:');
  console.log(pem.substring(0, 100));

  const cert = Certificate.fromPEM(Buffer.from(pem));
  console.log('cert.publicKeyRaw length:', cert.publicKeyRaw.length);
  console.log('cert.signature length:', cert.signature.length);
  console.log('cert.publicKeyRaw (hex):', cert.publicKeyRaw.toString('hex'));
  console.log('cert.signature (hex):', cert.signature.toString('hex'));

  await mongoose.disconnect();
}
test().catch(console.error);
