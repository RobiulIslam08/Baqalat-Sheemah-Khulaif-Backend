import * as crypto from 'crypto';
import { ZatcaCryptoHelper } from './zatcaCrypto.helper';
import { ZatcaTlvHelper } from './zatcaTlv.helper';

export interface ISignResult {
  signedXml: string;
  invoiceHash: string;
  signature: string;
  qrCodePayload: string;
}

export class ZatcaSignerService {
  /**
   * Digitally sign a UBL 2.1 invoice XML and embed XAdES-EPES signature and Phase 2 TLV QR code.
   */
  public signInvoiceXml(
    rawXml: string,
    privateKeyPem: string,
    certificateBase64: string
  ): ISignResult {
    // 1. Compute canonical invoice hash
    const { hash: invoiceHash } = ZatcaCryptoHelper.computeInvoiceHash(rawXml);

    // 2. Parse Certificate
    const certDetails = ZatcaCryptoHelper.extractCertificateDetails(certificateBase64);

    // 3. Signing timestamp in ISO 8601 UTC format (strictly without milliseconds per ZATCA rules)
    const signingTime = new Date().toISOString().split('.')[0] + 'Z';

    // 4. Construct xades:SignedProperties XML for hashing
    const signedPropertiesForSigning = `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
                                    <xades:SignedSignatureProperties>
                                        <xades:SigningTime>${signingTime}</xades:SigningTime>
                                        <xades:SigningCertificate>
                                            <xades:Cert>
                                                <xades:CertDigest>
                                                    <ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                                    <ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certDetails.certDigest}</ds:DigestValue>
                                                </xades:CertDigest>
                                                <xades:IssuerSerial>
                                                    <ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certDetails.issuerName}</ds:X509IssuerName>
                                                    <ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certDetails.serialNumber}</ds:X509SerialNumber>
                                                </xades:IssuerSerial>
                                            </xades:Cert>
                                        </xades:SigningCertificate>
                                    </xades:SignedSignatureProperties>
                                </xades:SignedProperties>`.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const signedPropertiesBytes = Buffer.from(signedPropertiesForSigning, 'utf8');
    const signedPropertiesHashHex = crypto.createHash('sha256').update(signedPropertiesBytes).digest('hex');
    const signedPropertiesDigest = Buffer.from(signedPropertiesHashHex).toString('base64');

    const signedPropertiesInXml = `<xades:SignedProperties Id="xadesSignedProperties">
                                    <xades:SignedSignatureProperties>
                                        <xades:SigningTime>${signingTime}</xades:SigningTime>
                                        <xades:SigningCertificate>
                                            <xades:Cert>
                                                <xades:CertDigest>
                                                    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                                    <ds:DigestValue>${certDetails.certDigest}</ds:DigestValue>
                                                </xades:CertDigest>
                                                <xades:IssuerSerial>
                                                    <ds:X509IssuerName>${certDetails.issuerName}</ds:X509IssuerName>
                                                    <ds:X509SerialNumber>${certDetails.serialNumber}</ds:X509SerialNumber>
                                                </xades:IssuerSerial>
                                            </xades:Cert>
                                        </xades:SigningCertificate>
                                    </xades:SignedSignatureProperties>
                                </xades:SignedProperties>`.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 5. Construct ds:SignedInfo XML
    const signedInfoXml = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
        <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
        <ds:Reference Id="invoiceSignedData" URI="">
            <ds:Transforms>
                <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                    <ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>
                </ds:Transform>
                <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                    <ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>
                </ds:Transform>
                <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                    <ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath>
                </ds:Transform>
                <ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
            </ds:Transforms>
            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
            <ds:DigestValue>${invoiceHash}</ds:DigestValue>
        </ds:Reference>
        <ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">
            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
            <ds:DigestValue>${signedPropertiesDigest}</ds:DigestValue>
        </ds:Reference>
    </ds:SignedInfo>`;

    // Sign invoice hash with EC private key
    const invoiceHashBytes = Buffer.from(invoiceHash, 'base64');
    const signer = crypto.createSign('sha256');
    signer.update(invoiceHashBytes);
    const signatureValue = signer.sign(privateKeyPem, 'base64');

    // 6. Complete XAdES-EPES ds:Signature block
    const fullSignatureBlock = `<sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2" xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
                <sac:SignatureInformation>
                    <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
                    <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
                    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
${signedInfoXml}
                        <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
                        <ds:KeyInfo>
                            <ds:X509Data>
                                <ds:X509Certificate>${certDetails.derBase64}</ds:X509Certificate>
                            </ds:X509Data>
                        </ds:KeyInfo>
                        <ds:Object>
                            <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">
${signedPropertiesInXml}
                            </xades:QualifyingProperties>
                        </ds:Object>
                    </ds:Signature>
                </sac:SignatureInformation>
            </sig:UBLDocumentSignatures>`;

    // Inject Signature into UBLExtension
    let signedXml = rawXml.replace(
      /<ext:ExtensionContent>[\s\S]*?<!-- ZATCA Signature will be injected here -->[\s\S]*?<\/ext:ExtensionContent>/,
      `<ext:ExtensionContent>\n            ${fullSignatureBlock}\n            </ext:ExtensionContent>`
    );

    // 7. Extract details to construct Phase 2 TLV QR Code (9 Tags for Phase 2)
    const sellerName = this.extractTagContent(rawXml, 'cac:AccountingSupplierParty', 'cbc:RegistrationName');
    const sellerVat = this.extractTagContent(rawXml, 'cac:AccountingSupplierParty', 'cbc:CompanyID');
    const issueDate = this.extractSingleTagContent(rawXml, 'cbc:IssueDate');
    const issueTime = this.extractSingleTagContent(rawXml, 'cbc:IssueTime');
    const totalInclusive = this.extractSingleTagContent(rawXml, 'cbc:TaxInclusiveAmount');
    const totalVat = this.extractTagContent(rawXml, 'cac:TaxTotal', 'cbc:TaxAmount');

    // QR Timestamp strictly matching Invoice Issue Date and Time (KSA-25)
    let qrTimestamp = signingTime;
    if (issueDate && issueTime) {
      qrTimestamp = `${issueDate.trim()}T${issueTime.trim()}`;
    }

    // Extract SubjectPublicKeyInfo DER bytes (Tag 8) and certificate CA signature bytes (Tag 9)
    let spkiDer: Buffer;
    let certCaSig: Buffer | undefined;

    try {
      // Use @fidm/x509 for robust ASN.1 parsing of raw public key and CA signature
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Certificate } = require('@fidm/x509');
      const parsedCert = Certificate.fromPEM(Buffer.from(certDetails.pem));
      spkiDer = parsedCert.publicKeyRaw;
      certCaSig = parsedCert.signature;
    } catch {
      const derBuf = Buffer.from(certDetails.derBase64, 'base64');
      const x509Obj = new crypto.X509Certificate(derBuf);
      spkiDer = x509Obj.publicKey.export({ type: 'spki', format: 'der' });
    }

    // TLV Tags:
    // 1: Seller's Name, 2: VAT Number, 3: Timestamp, 4: Total Inclusive, 5: Total VAT, 6: Invoice Hash, 7: Signature, 8: Public Key, 9: CA Signature
    const tlvTags: Record<number, string | Buffer> = {
      1: sellerName,
      2: sellerVat,
      3: qrTimestamp,
      4: totalInclusive || '0.00',
      5: totalVat || '0.00',
      6: invoiceHash,
      7: signatureValue,
      8: spkiDer,
    };

    if (certCaSig) {
      tlvTags[9] = certCaSig;
    }

    const qrCodePayload = ZatcaTlvHelper.encode(tlvTags);

    // 8. Inject QR Code into AdditionalDocumentReference (cbc:EmbeddedDocumentBinaryObject)
    signedXml = signedXml.replace(
      /<cbc:EmbeddedDocumentBinaryObject mimeCode="text\/plain">\s*QR_PLACEHOLDER\s*<\/cbc:EmbeddedDocumentBinaryObject>/,
      `<cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${qrCodePayload}</cbc:EmbeddedDocumentBinaryObject>`
    );

    return {
      signedXml,
      invoiceHash,
      signature: signatureValue,
      qrCodePayload,
    };
  }

  private extractTagContent(xml: string, parentTag: string, targetTag: string): string {
    const parentRegex = new RegExp(`<${parentTag}[\\s\\S]*?<\\/${parentTag}>`, 'm');
    const parentMatch = xml.match(parentRegex);
    if (!parentMatch) return '';

    const targetRegex = new RegExp(`<${targetTag}[^>]*>([\\s\\S]*?)<\\/${targetTag}>`, 'm');
    const targetMatch = parentMatch[0].match(targetRegex);
    return targetMatch ? targetMatch[1].trim() : '';
  }

  private extractSingleTagContent(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'm');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  }
}
