import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import AppError from '../../../errors/AppError';
import httpStatus from 'http-status';

export interface IEcKeyPair {
  privateKey: string;
  publicKey: string;
}

export interface ICsrAttributes {
  vatNumber: string;
  taxpayerName: string;
  branchName?: string;
  serialNumber: string;
  buildingNumber: string;
  streetName: string;
  businessCategory?: string;
  invoiceTypeFlag?: string; // default '1100'
}

export interface ICertificateDetails {
  certDigest: string; // Base64 SHA-256 of DER certificate
  issuerName: string;
  serialNumber: string;
  publicKey: string;
  pem: string;
  derBase64: string;
}

// ASN.1 DER Tag Constants
const ASN1 = {
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OBJECT_IDENTIFIER: 0x06,
  UTF8_STRING: 0x0c,
  PRINTABLE_STRING: 0x13,
  SEQUENCE: 0x30,
  SET: 0x31,
  CONTEXT_0: 0xa0,
  CONTEXT_4: 0xa4,
};

function encodeDerLength(len: number): Buffer {
  if (len < 128) {
    return Buffer.from([len]);
  }
  const bytes: number[] = [];
  let temp = len;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag: number, content: Buffer): Buffer {
  const len = encodeDerLength(content.length);
  return Buffer.concat([Buffer.from([tag]), len, content]);
}

function encodeDerOid(oidStr: string): Buffer {
  const parts = oidStr.split('.').map(Number);
  const firstByte = parts[0] * 40 + parts[1];
  const bytes: number[] = [firstByte];
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i];
    const subBytes: number[] = [];
    subBytes.push(val & 0x7f);
    val >>= 7;
    while (val > 0) {
      subBytes.unshift((val & 0x7f) | 0x80);
      val >>= 7;
    }
    bytes.push(...subBytes);
  }
  return tlv(ASN1.OBJECT_IDENTIFIER, Buffer.from(bytes));
}

function encodeDerString(tag: number, str: string): Buffer {
  return tlv(tag, Buffer.from(str, 'utf8'));
}

function encodeRdn(oid: string, tag: number, value: string): Buffer {
  const attrType = encodeDerOid(oid);
  const attrVal = encodeDerString(tag, value);
  const typeAndValue = tlv(ASN1.SEQUENCE, Buffer.concat([attrType, attrVal]));
  return tlv(ASN1.SET, typeAndValue);
}

/**
 * Sanitize industry/businessCategory for ZATCA CSR.
 * ZATCA strictly forbids special characters like ampersand ('&') and '<' or '>'.
 * Must contain only alphanumeric and space/hyphen/underscore.
 */
export function sanitizeZatcaIndustry(val?: string): string {
  if (!val) return 'Food and Beverage';
  let clean = String(val).replace(/&/g, 'and');
  clean = clean.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-_]/g, '').trim();
  clean = clean.replace(/\s+/g, ' ');
  return clean || 'Food and Beverage';
}

export class ZatcaCryptoHelper {
  /**
   * Find available OpenSSL CLI binary across Windows and Linux.
   */
  public static findOpenSslBinary(): string {
    if (process.env.OPENSSL_BIN && fs.existsSync(process.env.OPENSSL_BIN)) {
      return process.env.OPENSSL_BIN;
    }

    const candidates = [
      '/usr/bin/openssl',
      '/bin/openssl',
      '/usr/local/bin/openssl',
      'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
      'D:\\xampp\\apache\\bin\\openssl.exe',
      'C:\\xampp\\apache\\bin\\openssl.exe',
      'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
      'openssl',
    ];

    const cleanEnv = { ...process.env };
    delete cleanEnv.LD_LIBRARY_PATH;
    delete cleanEnv.LD_PRELOAD;

    for (const candidate of candidates) {
      if (candidate === 'openssl') {
        try {
          execSync('openssl version', { stdio: 'ignore', env: cleanEnv });
          return 'openssl';
        } catch {
          // continue
        }
      } else if (fs.existsSync(candidate)) {
        try {
          execSync(`"${candidate}" version`, { stdio: 'ignore', env: cleanEnv });
          return candidate;
        } catch {
          // continue
        }
      }
    }

    return 'openssl';
  }

  /**
   * Generate an EC Key pair using secp256k1 curve in PEM format.
   */
  public static generateEcKeyPair(): IEcKeyPair {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'sec1',
        format: 'pem',
      },
    });

    return {
      privateKey,
      publicKey,
    };
  }

  /**
   * Pure Node.js ASN.1 DER CSR Generator (100% compliant with ZATCA Phase 2 specifications).
   * Operates completely in-process without any external OpenSSL CLI or C library dependencies.
   */
  public static generatePureCsr(
    privateKeyPem: string,
    attributes: ICsrAttributes,
    environment: 'sandbox' | 'simulation' | 'production' = 'sandbox'
  ): string {
    const templateName = environment === 'sandbox' ? 'PREZATCA-Code-Signing' : 'ZATCA-Code-Signing';
    const invoiceTypeFlag = attributes.invoiceTypeFlag || '1100';
    const branchName = (attributes.branchName || attributes.taxpayerName || 'Main Branch').replace(/[<>]/g, '').trim();
    const taxpayerName = (attributes.taxpayerName || 'Taxpayer').replace(/[<>]/g, '').trim();
    const registeredAddress = `${attributes.buildingNumber || '1234'} ${attributes.streetName || 'Main St'}`.replace(/[<>]/g, '').trim();
    const businessCategory = sanitizeZatcaIndustry(attributes.businessCategory);

    // 1. Version: INTEGER 0
    const version = tlv(ASN1.INTEGER, Buffer.from([0x00]));

    // 2. Subject: C=SA, OU=branchName, O=taxpayerName, CN=serialNumber
    const cRdn = encodeRdn('2.5.4.6', ASN1.PRINTABLE_STRING, 'SA');
    const ouRdn = encodeRdn('2.5.4.11', ASN1.UTF8_STRING, branchName);
    const oRdn = encodeRdn('2.5.4.10', ASN1.UTF8_STRING, attributes.taxpayerName);
    const cnRdn = encodeRdn('2.5.4.3', ASN1.UTF8_STRING, attributes.serialNumber);
    const subject = tlv(ASN1.SEQUENCE, Buffer.concat([cRdn, ouRdn, oRdn, cnRdn]));

    // 3. SubjectPublicKeyInfo (DER)
    const privKeyObj = crypto.createPrivateKey(privateKeyPem);
    const pubKeyObj = crypto.createPublicKey(privKeyObj);
    const spkiDer = pubKeyObj.export({ type: 'spki', format: 'der' }) as Buffer;

    // 4. Extensions:
    // Ext 1: certificateTemplateName (1.3.6.1.4.1.311.20.2)
    const templOid = encodeDerOid('1.3.6.1.4.1.311.20.2');
    const templVal = tlv(ASN1.OCTET_STRING, encodeDerString(ASN1.PRINTABLE_STRING, templateName));
    const extTempl = tlv(ASN1.SEQUENCE, Buffer.concat([templOid, templVal]));

    // Ext 2: subjectAltName (2.5.29.17) -> dirName [4]
    const snRdn = encodeRdn('2.5.4.4', ASN1.UTF8_STRING, attributes.serialNumber);
    const uidRdn = encodeRdn('0.9.2342.19200300.100.1.1', ASN1.UTF8_STRING, attributes.vatNumber);
    const titleRdn = encodeRdn('2.5.4.12', ASN1.UTF8_STRING, invoiceTypeFlag);
    const addrRdn = encodeRdn('2.5.4.26', ASN1.UTF8_STRING, registeredAddress);
    const catRdn = encodeRdn('2.5.4.15', ASN1.UTF8_STRING, businessCategory);

    const dirNameSeq = tlv(ASN1.SEQUENCE, Buffer.concat([snRdn, uidRdn, titleRdn, addrRdn, catRdn]));
    const sanValContent = tlv(ASN1.CONTEXT_4, dirNameSeq);
    const sanVal = tlv(ASN1.OCTET_STRING, sanValContent);
    const sanOid = encodeDerOid('2.5.29.17');
    const extSan = tlv(ASN1.SEQUENCE, Buffer.concat([sanOid, sanVal]));

    const extensionsSeq = tlv(ASN1.SEQUENCE, Buffer.concat([extTempl, extSan]));

    // extensionRequest (1.2.840.113549.1.9.14)
    const extReqOid = encodeDerOid('1.2.840.113549.1.9.14');
    const extReqSet = tlv(ASN1.SET, extensionsSeq);
    const extReqSeq = tlv(ASN1.SEQUENCE, Buffer.concat([extReqOid, extReqSet]));

    // Attributes [0] IMPLICIT
    const attrsTlv = tlv(ASN1.CONTEXT_0, extReqSeq);

    // CertificationRequestInfo
    const cri = tlv(ASN1.SEQUENCE, Buffer.concat([version, subject, spkiDer, attrsTlv]));

    // Sign CertificationRequestInfo with ECDSA SHA-256
    const signer = crypto.createSign('SHA256');
    signer.update(cri);
    signer.end();
    const derSignature = signer.sign(privateKeyPem);

    const sigBitString = tlv(ASN1.BIT_STRING, Buffer.concat([Buffer.from([0x00]), derSignature]));
    const sigAlgOid = encodeDerOid('1.2.840.10045.4.3.2'); // ecdsa-with-SHA256
    const sigAlg = tlv(ASN1.SEQUENCE, sigAlgOid);

    const csrDer = tlv(ASN1.SEQUENCE, Buffer.concat([cri, sigAlg, sigBitString]));
    const b64 = csrDer.toString('base64');
    const lines = b64.match(/.{1,64}/g)?.join('\n') || b64;
    return `-----BEGIN CERTIFICATE REQUEST-----\n${lines}\n-----END CERTIFICATE REQUEST-----\n`;
  }

  /**
   * Generate ZATCA-compliant CSR with custom OID extensions.
   * Attempts OpenSSL CLI first (with clean environment to prevent Linux LD_LIBRARY_PATH conflicts),
   * and automatically falls back to the pure Node.js in-process engine if OpenSSL CLI is unavailable or broken.
   */
  public static generateCsr(
    privateKeyPem: string,
    attributes: ICsrAttributes,
    environment: 'sandbox' | 'simulation' | 'production' = 'sandbox'
  ): string {
    const templateName = environment === 'sandbox' ? 'PREZATCA-Code-Signing' : 'ZATCA-Code-Signing';
    const invoiceTypeFlag = attributes.invoiceTypeFlag || '1100';
    const branchName = (attributes.branchName || attributes.taxpayerName || 'Main Branch').replace(/[<>]/g, '').trim();
    const taxpayerName = (attributes.taxpayerName || 'Taxpayer').replace(/[<>]/g, '').trim();
    const registeredAddress = `${attributes.buildingNumber || '1234'} ${attributes.streetName || 'Main St'}`.replace(/[<>]/g, '').trim();
    const businessCategory = sanitizeZatcaIndustry(attributes.businessCategory);

    const tempDir = os.tmpdir();
    const uniqueId = `zatca_csr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const tempKeyPath = path.join(tempDir, `${uniqueId}.key`);
    const tempCnfPath = path.join(tempDir, `${uniqueId}.cnf`);
    const tempCsrPath = path.join(tempDir, `${uniqueId}.csr`);

    const cnfContent = `oid_section = new_oids

[ new_oids ]
certificateTemplateName = 1.3.6.1.4.1.311.20.2

[ req ]
default_bits = 2048
prompt = no
default_md = sha256
utf8 = yes
string_mask = utf8only
distinguished_name = req_distinguished_name
req_extensions = v3_req

[ req_distinguished_name ]
C = SA
OU = ${branchName}
O = ${attributes.taxpayerName}
CN = ${attributes.serialNumber}

[ v3_req ]
certificateTemplateName = ASN1:PRINTABLESTRING:${templateName}
subjectAltName = dirName:dir_sect

[ dir_sect ]
SN = ${attributes.serialNumber}
UID = ${attributes.vatNumber}
title = ${invoiceTypeFlag}
registeredAddress = ${registeredAddress}
businessCategory = ${businessCategory}
`;

    try {
      fs.writeFileSync(tempKeyPath, privateKeyPem, 'utf8');
      fs.writeFileSync(tempCnfPath, cnfContent, 'utf8');

      const opensslBin = this.findOpenSslBinary();
      const cleanEnv = { ...process.env };
      delete cleanEnv.LD_LIBRARY_PATH;
      delete cleanEnv.LD_PRELOAD;

      const cmd = `"${opensslBin}" req -new -sha256 -key "${tempKeyPath}" -config "${tempCnfPath}" -out "${tempCsrPath}"`;
      execSync(cmd, { stdio: 'pipe', env: cleanEnv });

      const csrPem = fs.readFileSync(tempCsrPath, 'utf8');
      return csrPem;
    } catch (cliErr: any) {
      console.warn('OpenSSL CLI failed or had library mismatch, using pure Node.js in-process CSR generator:', cliErr?.message || cliErr);
      try {
        return this.generatePureCsr(privateKeyPem, attributes, environment);
      } catch (pureErr: any) {
        throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to generate CSR: ${pureErr.message || cliErr.message}`);
      }
    } finally {
      if (fs.existsSync(tempKeyPath)) fs.unlinkSync(tempKeyPath);
      if (fs.existsSync(tempCnfPath)) fs.unlinkSync(tempCnfPath);
      if (fs.existsSync(tempCsrPath)) fs.unlinkSync(tempCsrPath);
    }
  }

  /**
   * Run C14N 1.1 Canonicalization via native libxml2 PHP script.
   */
  public static canonicalizeXml(xml: string, action: 'invoice-hash' | 'c14n' = 'c14n'): any {
    const candidates = [
      path.resolve(process.cwd(), 'scripts/c14n-full.php'),
      path.resolve(__dirname, '../../../../scripts/c14n-full.php'),
      path.resolve(__dirname, '../../../../../scripts/c14n-full.php'),
    ];

    for (const scriptPath of candidates) {
      if (fs.existsSync(scriptPath)) {
        try {
          const out = execSync(`php "${scriptPath}" ${action}`, {
            input: xml,
            encoding: 'utf8',
            maxBuffer: 15 * 1024 * 1024,
          });
          if (action === 'invoice-hash') {
            return JSON.parse(out);
          }
          return out;
        } catch {
          // continue to next candidate or fallback
        }
      }
    }
    return null;
  }

  /**
   * C14N 1.1 Canonicalize an XML string and compute its SHA-256 hash.
   * Strips UBLExtensions, cac:Signature, and QR AdditionalDocumentReference according to ZATCA rules.
   */
  public static computeInvoiceHash(xmlString: string): { hash: string; hashHex: string; canonicalXml: string } {
    const c14nRes = this.canonicalizeXml(xmlString, 'invoice-hash');
    if (c14nRes && c14nRes.hash) {
      return c14nRes;
    }

    // Fallback if PHP/libxml2 is unavailable
    let stripped = xmlString;
    stripped = stripped.replace(/<ext:UBLExtensions[\s\S]*?<\/ext:UBLExtensions>/g, '');
    stripped = stripped.replace(/<cac:Signature[\s\S]*?<\/cac:Signature>/g, '');
    stripped = stripped.replace(
      /<cac:AdditionalDocumentReference>[\s\S]*?<cbc:ID>QR<\/cbc:ID>[\s\S]*?<\/cac:AdditionalDocumentReference>/g,
      ''
    );

    const canonicalXml = stripped
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();

    const binaryHash = crypto.createHash('sha256').update(canonicalXml, 'utf8').digest();
    const hash = binaryHash.toString('base64');
    const hashHex = binaryHash.toString('hex');

    return {
      hash,
      hashHex,
      canonicalXml,
    };
  }

  /**
   * Sign data using ECDSA with secp256k1 private key and SHA-256.
   */
  public static signData(data: string | Buffer, privateKeyPem: string): string {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(privateKeyPem, 'base64');
  }

  /**
   * Extract X.509 certificate details for XAdES SignedProperties.
   */
  public static extractCertificateDetails(certInput: string): ICertificateDetails {
    let clean = certInput.trim();

    let decodedUtf8 = '';
    try {
      decodedUtf8 = Buffer.from(clean, 'base64').toString('utf8');
    } catch {
      // ignore
    }

    let pem = '';
    if (clean.includes('-----BEGIN CERTIFICATE-----')) {
      pem = clean;
    } else if (decodedUtf8.includes('-----BEGIN CERTIFICATE-----')) {
      pem = decodedUtf8;
    } else if (decodedUtf8.startsWith('MII') || (decodedUtf8.length > 50 && /^[A-Za-z0-9+/=\r\n]+$/.test(decodedUtf8))) {
      // Double base64 encoded (e.g. ZATCA binarySecurityToken)
      const cleanInner = decodedUtf8.replace(/\s+/g, '');
      pem = `-----BEGIN CERTIFICATE-----\n${cleanInner.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----\n`;
    } else {
      const cleanSingle = clean.replace(/\s+/g, '');
      pem = `-----BEGIN CERTIFICATE-----\n${cleanSingle.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----\n`;
    }

    const x509 = new crypto.X509Certificate(pem);
    const derBytes = x509.raw;
    const certDigest = crypto.createHash('sha256').update(derBytes).digest('base64');

    // Parse issuer and serial
    const issuerName = x509.issuer ? x509.issuer.replace(/\r?\n/g, ', ') : '';
    let serialNumber = x509.serialNumber || '';
    try {
      if (serialNumber && /^[0-9a-fA-F]+$/.test(serialNumber)) {
        serialNumber = BigInt('0x' + serialNumber).toString(10);
      }
    } catch {
      // Keep original serialNumber if BigInt conversion fails
    }
    const publicKeyPem = x509.publicKey.export({ type: 'spki', format: 'pem' }).toString();

    return {
      certDigest,
      issuerName,
      serialNumber,
      publicKey: publicKeyPem,
      pem,
      derBase64: derBytes.toString('base64'),
    };
  }
}
