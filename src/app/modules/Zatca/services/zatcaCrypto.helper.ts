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

export class ZatcaCryptoHelper {
  /**
   * Find available OpenSSL CLI binary across Windows and Linux.
   */
  public static findOpenSslBinary(): string {
    if (process.env.OPENSSL_BIN && fs.existsSync(process.env.OPENSSL_BIN)) {
      return process.env.OPENSSL_BIN;
    }

    const candidates = [
      'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
      'D:\\xampp\\apache\\bin\\openssl.exe',
      'C:\\xampp\\apache\\bin\\openssl.exe',
      'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
      'openssl',
    ];

    for (const candidate of candidates) {
      if (candidate === 'openssl') {
        try {
          execSync('openssl version', { stdio: 'ignore' });
          return 'openssl';
        } catch {
          // continue
        }
      } else if (fs.existsSync(candidate)) {
        return candidate;
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
   * Generate ZATCA-compliant CSR with custom OID extensions.
   */
  public static generateCsr(
    privateKeyPem: string,
    attributes: ICsrAttributes,
    environment: 'sandbox' | 'simulation' | 'production' = 'sandbox'
  ): string {
    const templateName = environment === 'sandbox' ? 'PREZATCA-Code-Signing' : 'ZATCA-Code-Signing';
    const invoiceTypeFlag = attributes.invoiceTypeFlag || '1100';
    const branchName = attributes.branchName || attributes.taxpayerName;
    const registeredAddress = `${attributes.buildingNumber} ${attributes.streetName}`;
    const businessCategory = attributes.businessCategory || 'Food & Beverage';

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
      const cmd = `"${opensslBin}" req -new -sha256 -key "${tempKeyPath}" -config "${tempCnfPath}" -out "${tempCsrPath}"`;
      execSync(cmd, { stdio: 'pipe' });

      const csrPem = fs.readFileSync(tempCsrPath, 'utf8');
      return csrPem;
    } catch (err: any) {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to generate CSR: ${err.message}`);
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
