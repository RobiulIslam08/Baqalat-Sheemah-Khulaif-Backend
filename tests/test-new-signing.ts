import { ZatcaConfig } from '../src/app/modules/Zatca/zatca.model';
import { ZatcaApiService } from '../src/app/modules/Zatca/services/zatcaApi.service';
import { ZatcaXmlGeneratorService } from '../src/app/modules/Zatca/services/zatcaXmlGenerator.service';
import { ZatcaCryptoHelper } from '../src/app/modules/Zatca/services/zatcaCrypto.helper';
import { ZatcaTlvHelper } from '../src/app/modules/Zatca/services/zatcaTlv.helper';
import * as crypto from 'crypto';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

function cleanUpCertificateString(certificate_string: string) {
  let decoded = Buffer.from(certificate_string, 'base64').toString('utf8');
  let cleanCertB64 = decoded.startsWith('MI') ? decoded : certificate_string;
  return cleanCertB64.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s+/g, '');
}

function getCertificateHash(certificate_string: string) {
  const clean = cleanUpCertificateString(certificate_string);
  const hex = crypto.createHash('sha256').update(clean).digest('hex');
  return Buffer.from(hex).toString('base64');
}

function defaultUBLExtensionsSignedPropertiesForSigning({
  sign_timestamp,
  certificate_hash,
  certificate_issuer,
  certificate_serial_number,
}: any) {
  const tpl = `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
                                    <xades:SignedSignatureProperties>
                                        <xades:SigningTime>SET_SIGN_TIMESTAMP</xades:SigningTime>
                                        <xades:SigningCertificate>
                                            <xades:Cert>
                                                <xades:CertDigest>
                                                    <ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                                    <ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">SET_CERTIFICATE_HASH</ds:DigestValue>
                                                </xades:CertDigest>
                                                <xades:IssuerSerial>
                                                    <ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">SET_CERTIFICATE_ISSUER</ds:X509IssuerName>
                                                    <ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">SET_CERTIFICATE_SERIAL_NUMBER</ds:X509SerialNumber>
                                                </xades:IssuerSerial>
                                            </xades:Cert>
                                        </xades:SigningCertificate>
                                    </xades:SignedSignatureProperties>
                                </xades:SignedProperties>`.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  return tpl
    .replace('SET_SIGN_TIMESTAMP', sign_timestamp)
    .replace('SET_CERTIFICATE_HASH', certificate_hash)
    .replace('SET_CERTIFICATE_ISSUER', certificate_issuer)
    .replace('SET_CERTIFICATE_SERIAL_NUMBER', certificate_serial_number);
}

function populateSignedPropertiesAfterSigning({
  sign_timestamp,
  certificate_hash,
  certificate_issuer,
  certificate_serial_number,
}: any) {
  return `<xades:SignedProperties Id="xadesSignedProperties">
                                    <xades:SignedSignatureProperties>
                                        <xades:SigningTime>${sign_timestamp}</xades:SigningTime>
                                        <xades:SigningCertificate>
                                            <xades:Cert>
                                                <xades:CertDigest>
                                                    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                                    <ds:DigestValue>${certificate_hash}</ds:DigestValue>
                                                </xades:CertDigest>
                                                <xades:IssuerSerial>
                                                    <ds:X509IssuerName>${certificate_issuer}</ds:X509IssuerName>
                                                    <ds:X509SerialNumber>${certificate_serial_number}</ds:X509SerialNumber>
                                                </xades:IssuerSerial>
                                            </xades:Cert>
                                        </xades:SigningCertificate>
                                    </xades:SignedSignatureProperties>
                                </xades:SignedProperties>`.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function signedPropertiesIndentationFix(signed_invoice_string: string) {
  let fixer = signed_invoice_string;
  if (!fixer.includes('<ds:Object>') || !fixer.includes('</ds:Object>')) return fixer;
  let signed_props_lines = fixer.split('<ds:Object>')[1].split('</ds:Object>')[0].split('\n');
  let fixed_lines: string[] = [];
  signed_props_lines.forEach((line) => fixed_lines.push(line.slice(4, line.length)));
  signed_props_lines = signed_props_lines.slice(0, signed_props_lines.length - 1);
  fixed_lines = fixed_lines.slice(0, fixed_lines.length - 1);
  fixer = fixer.replace(signed_props_lines.join('\n'), fixed_lines.join('\n'));
  return fixer;
}

function signTestInvoice(rawXml: string, privateKeyPem: string, certificateBase64: string) {
  const cleanCert = cleanUpCertificateString(certificateBase64);
  const certDer = Buffer.from(cleanCert, 'base64');
  const x509 = new crypto.X509Certificate(certDer);

  const certHash = getCertificateHash(cleanCert);
  const issuer = x509.issuer ? x509.issuer.replace(/\r?\n/g, ', ') : 'CN=eInvoicing';
  const serialNumber = BigInt('0x' + x509.serialNumber).toString(10);
  const signingTime = new Date().toISOString().split('.')[0] + 'Z';

  // 1. Invoice hash
  const { hash: invoiceHash } = ZatcaCryptoHelper.computeInvoiceHash(rawXml);

  // 2. Digital Signature
  const invoiceHashBytes = Buffer.from(invoiceHash, 'base64');
  const signer = crypto.createSign('sha256');
  signer.update(invoiceHashBytes);
  const digitalSignature = signer.sign(privateKeyPem, 'base64');

  // 3. Signed properties for signing & hash
  const signedPropsProps = {
    sign_timestamp: signingTime,
    certificate_hash: certHash,
    certificate_issuer: issuer,
    certificate_serial_number: serialNumber,
  };

  const signedPropsForSigning = defaultUBLExtensionsSignedPropertiesForSigning(signedPropsProps);
  const signedPropsBytes = Buffer.from(signedPropsForSigning, 'utf8');
  let signedPropsHashHex = crypto.createHash('sha256').update(signedPropsBytes).digest('hex');
  const signedPropsHash = Buffer.from(signedPropsHashHex).toString('base64');

  const signedPropsAfterSigning = populateSignedPropertiesAfterSigning(signedPropsProps);

  // 4. Construct UBL Extension Signatures block
  const ublSignatureXml = `<ext:UBLExtension>
        <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
        <ext:ExtensionContent>
            <sig:UBLDocumentSignatures
                    xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"
                    xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2"
                    xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2">
                <sac:SignatureInformation>
                    <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
                    <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
                    <ds:Signature Id="signature" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
                        <ds:SignedInfo>
                            <ds:CanonicalizationMethod
                                    Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                            <ds:SignatureMethod
                                    Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
                            <ds:Reference Id="invoiceSignedData" URI="">
                                <ds:Transforms>
                                    <ds:Transform
                                            Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                        <ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>
                                    </ds:Transform>
                                    <ds:Transform
                                            Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                        <ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>
                                    </ds:Transform>
                                    <ds:Transform
                                            Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                                        <ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath>
                                    </ds:Transform>
                                    <ds:Transform
                                            Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                                </ds:Transforms>
                                <ds:DigestMethod
                                        Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                <ds:DigestValue>${invoiceHash}</ds:DigestValue>
                            </ds:Reference>
                            <ds:Reference
                                    Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties"
                                    URI="#xadesSignedProperties">
                                <ds:DigestMethod
                                        Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                <ds:DigestValue>${signedPropsHash}</ds:DigestValue>
                            </ds:Reference>
                        </ds:SignedInfo>
                        <ds:SignatureValue>${digitalSignature}</ds:SignatureValue>
                        <ds:KeyInfo>
                            <ds:X509Data>
                                <ds:X509Certificate>${cleanCert}</ds:X509Certificate>
                            </ds:X509Data>
                        </ds:KeyInfo>
                        <ds:Object>
                            <xades:QualifyingProperties Target="signature"
                                                        xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
                                ${signedPropsAfterSigning}
                            </xades:QualifyingProperties>
                        </ds:Object>
                    </ds:Signature>
                </sac:SignatureInformation>
            </sig:UBLDocumentSignatures>
        </ext:ExtensionContent>
    </ext:UBLExtension>`;

  // 5. TLV QR Code
  const sellerNameMatch = rawXml.match(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:RegistrationName>([\s\S]*?)<\/cbc:RegistrationName>/);
  const sellerVatMatch = rawXml.match(/<cac:AccountingSupplierParty>[\s\S]*?<cbc:CompanyID>([\s\S]*?)<\/cbc:CompanyID>/);
  const issueDateMatch = rawXml.match(/<cbc:IssueDate>([\s\S]*?)<\/cbc:IssueDate>/);
  const issueTimeMatch = rawXml.match(/<cbc:IssueTime>([\s\S]*?)<\/cbc:IssueTime>/);
  const totalIncMatch = rawXml.match(/<cbc:TaxInclusiveAmount[^>]*>([\s\S]*?)<\/cbc:TaxInclusiveAmount>/);
  const totalVatMatch = rawXml.match(/<cac:TaxTotal>[\s\S]*?<cbc:TaxAmount[^>]*>([\s\S]*?)<\/cbc:TaxAmount>/);

  const sellerName = sellerNameMatch ? sellerNameMatch[1].trim() : '';
  const sellerVat = sellerVatMatch ? sellerVatMatch[1].trim() : '';
  const issueDate = issueDateMatch ? issueDateMatch[1].trim() : '';
  const issueTime = issueTimeMatch ? issueTimeMatch[1].trim() : '';
  const totalInclusive = totalIncMatch ? totalIncMatch[1].trim() : '0.00';
  const totalVat = totalVatMatch ? totalVatMatch[1].trim() : '0.00';
  const qrTimestamp = issueDate && issueTime ? `${issueDate}T${issueTime}` : signingTime;

  const spkiDer = x509.publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  let certCaSig: Buffer | undefined;
  const lastBitIndex = certDer.lastIndexOf(0x03);
  if (lastBitIndex > 0 && certDer[lastBitIndex + 2] === 0) {
    certCaSig = certDer.subarray(lastBitIndex + 3, lastBitIndex + 3 + certDer[lastBitIndex + 1] - 1);
  }

  const tlvTags: Record<number, string | Buffer> = {
    1: sellerName,
    2: sellerVat,
    3: qrTimestamp,
    4: totalInclusive,
    5: totalVat,
    6: invoiceHash,
    7: digitalSignature,
    8: spkiDer,
  };
  if (certCaSig) tlvTags[9] = certCaSig;
  const qrCodePayload = ZatcaTlvHelper.encode(tlvTags);

  // 6. Inject into raw XML
  let signedXml = rawXml.replace(
    /<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/,
    `<ext:UBLExtensions>${ublSignatureXml}</ext:UBLExtensions>`
  );

  signedXml = signedXml.replace(
    /<cbc:EmbeddedDocumentBinaryObject mimeCode="text\/plain">\s*QR_PLACEHOLDER\s*<\/cbc:EmbeddedDocumentBinaryObject>/,
    `<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${qrCodePayload}</cbc:EmbeddedDocumentBinaryObject>`
  );

  // signedXml = signedPropertiesIndentationFix(signedXml);

  return {
    signedXml,
    invoiceHash,
    signature: digitalSignature,
    qrCodePayload,
  };
}

async function run() {
  await mongoose.connect(process.env.DATABASE_URL!);
  const cfg = await ZatcaConfig.findOne({ branchId: 'MAIN-BRANCH' });
  if (!cfg) throw new Error('No config found');

  const xmlGen = new ZatcaXmlGeneratorService();
  const api = new ZatcaApiService(cfg.environment as any);

  const uuid = crypto.randomUUID();
  const build = xmlGen.buildInvoiceXml(
    {
      invoiceNumber: `TEST-SIMP-${Date.now()}`,
      uuid,
      invoiceType: 'simplified',
      transactionType: 'invoice_388',
      items: [
        {
          name: 'Fresh Milk',
          quantity: 2,
          unitPrice: 15,
          vatRate: 15,
          vatCategory: 'S',
        },
      ],
      totalExclusiveVat: 30,
      totalVatAmount: 4.5,
      totalInclusiveVat: 34.5,
    },
    cfg,
    1,
    'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI4NjExN2Q5MTU0NWNmNEY='
  );

  const signed = signTestInvoice(build.xml, cfg.privateKey!, cfg.complianceCsid!);

  console.log('--- Submitting Test Simplified Invoice to ZATCA Compliance API ---');
  const res = await api.submitComplianceInvoice(
    cfg.complianceCsid!,
    cfg.complianceSecret!,
    signed.invoiceHash,
    uuid,
    signed.signedXml,
    false
  );

  console.log('Status Code:', res.statusCode);
  console.log('Success:', res.success);
  console.log('Clearance Status:', res.clearanceStatus);
  console.log('Reporting Status:', res.reportingStatus);
  console.log('Validation Results:', JSON.stringify(res.validationResults, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
