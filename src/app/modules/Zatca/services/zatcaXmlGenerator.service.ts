import { IZatcaConfig, IZatcaCustomer, IZatcaInvoiceItem } from '../zatca.interface';
import { ZatcaCryptoHelper } from './zatcaCrypto.helper';

export interface IInvoiceBuildData {
  invoiceNumber: string;
  uuid: string;
  invoiceType: 'standard' | 'simplified';
  transactionType?: 'invoice_388' | 'credit_note_381' | 'debit_note_383';
  billingReferenceId?: string;
  issueDatetime?: Date | string;
  paymentMeansCode?: string;
  customer?: IZatcaCustomer;
  items: IZatcaInvoiceItem[];
  totalExclusiveVat: number;
  totalVatAmount: number;
  totalInclusiveVat: number;
}

export class ZatcaXmlGeneratorService {
  /**
   * Build complete UBL 2.1 XML string and calculate canonical SHA-256 hash.
   */
  public buildInvoiceXml(
    data: IInvoiceBuildData,
    config: IZatcaConfig,
    icv: number,
    pih: string
  ): { xml: string; invoiceHash: string } {
    const currency = 'SAR';
    const dateObj = data.issueDatetime ? new Date(data.issueDatetime) : new Date();

    // Format date and time in KSA (UTC+3)
    const ksaDate = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }); // YYYY-MM-DD
    const ksaTime = dateObj.toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh', hour12: false }); // HH:MM:SS

    const txTypeCode =
      data.transactionType === 'credit_note_381'
        ? '381'
        : data.transactionType === 'debit_note_383'
        ? '383'
        : '388';

    const subType = data.invoiceType === 'standard' ? '0100000' : '0200000';

    // 1. Line Items Calculation
    let totalExclusive = 0;
    let totalVat = 0;
    let totalInclusive = 0;

    const linesXml = data.items
      .map((item, index) => {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unitPrice) || 0;
        const discount = Number(item.discount) || 0;
        const lineExtension = Number((qty * unitPrice - discount).toFixed(2));
        const vatRate = Number(item.vatRate ?? 15);
        const lineVat = Number((lineExtension * (vatRate / 100)).toFixed(2));
        const lineInclusive = Number((lineExtension + lineVat).toFixed(2));

        totalExclusive += lineExtension;
        totalVat += lineVat;
        totalInclusive += lineInclusive;

        return `    <cac:InvoiceLine>
        <cbc:ID>${index + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${item.unitCode || 'PCE'}">${qty.toFixed(2)}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${currency}">${lineExtension.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="${currency}">${lineVat.toFixed(2)}</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="${currency}">${lineInclusive.toFixed(2)}</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>${this.escapeXml(item.name)}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>${item.vatCategory || 'S'}</cbc:ID>
                <cbc:Percent>${vatRate.toFixed(2)}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="${currency}">${unitPrice.toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`;
      })
      .join('\n');

    // Ensure totalInclusive strictly equals totalExclusive + totalVat (ZATCA BR-CO-15)
    totalExclusive = Number(totalExclusive.toFixed(2));
    totalVat = Number(totalVat.toFixed(2));
    totalInclusive = Number((totalExclusive + totalVat).toFixed(2));

    // 2. Billing Reference (Credit/Debit Note)
    const billingRefXml =
      data.billingReferenceId && ['381', '383'].includes(txTypeCode)
        ? `    <cac:BillingReference>
        <cac:InvoiceDocumentReference>
            <cbc:ID>${this.escapeXml(data.billingReferenceId)}</cbc:ID>
        </cac:InvoiceDocumentReference>
    </cac:BillingReference>`
        : '';

    // 3. Customer Party
    let customerPartyXml = '';
    if (data.invoiceType === 'standard' && data.customer) {
      customerPartyXml = `    <cac:AccountingCustomerParty>
        <cac:Party>
            ${
              data.customer.vatNumber
                ? `<cac:PartyTaxScheme>
                <cbc:CompanyID>${data.customer.vatNumber}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>`
                : ''
            }
            <cac:PostalAddress>
                <cbc:StreetName>${this.escapeXml(data.customer.streetName || 'Main Street')}</cbc:StreetName>
                <cbc:BuildingNumber>${this.escapeXml(data.customer.buildingNumber || '0000')}</cbc:BuildingNumber>
                ${
                  data.customer.citySubdivision
                    ? `<cbc:CitySubdivisionName>${this.escapeXml(data.customer.citySubdivision)}</cbc:CitySubdivisionName>`
                    : ''
                }
                <cbc:CityName>${this.escapeXml(data.customer.cityName || 'Riyadh')}</cbc:CityName>
                <cbc:PostalZone>${this.escapeXml(data.customer.postalCode || '11111')}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${data.customer.countryCode || 'SA'}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${this.escapeXml(data.customer.name)}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>`;
    } else {
      customerPartyXml = `    <cac:AccountingCustomerParty>
        <cac:Party>
            ${
              data.customer?.name
                ? `<cac:PartyLegalEntity>
                <cbc:RegistrationName>${this.escapeXml(data.customer.name)}</cbc:RegistrationName>
            </cac:PartyLegalEntity>`
                : ''
            }
        </cac:Party>
    </cac:AccountingCustomerParty>`;
    }

    // 4. Construct complete UBL 2.1 XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
            <ext:ExtensionContent>
                <!-- ZATCA Signature will be injected here -->
            </ext:ExtensionContent>
        </ext:UBLExtension>
    </ext:UBLExtensions>
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>${this.escapeXml(data.invoiceNumber)}</cbc:ID>
    <cbc:UUID>${data.uuid}</cbc:UUID>
    <cbc:IssueDate>${ksaDate}</cbc:IssueDate>
    <cbc:IssueTime>${ksaTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="${subType}">${txTypeCode}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>${currency}</cbc:TaxCurrencyCode>
${billingRefXml ? billingRefXml + '\n' : ''}    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>${icv}</cbc:UUID>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${pih}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>QR</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">QR_PLACEHOLDER</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:Signature>
        <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
        <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
    </cac:Signature>
    <cac:AccountingSupplierParty>
        <cac:Party>
            ${
              config.crn
                ? `<cac:PartyIdentification>
                <cbc:ID schemeID="CRN">${this.escapeXml(config.crn)}</cbc:ID>
            </cac:PartyIdentification>`
                : ''
            }
            <cac:PostalAddress>
                <cbc:StreetName>${this.escapeXml(config.streetName || 'Main Street')}</cbc:StreetName>
                <cbc:BuildingNumber>${this.escapeXml(config.buildingNumber || '1234')}</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>${this.escapeXml(config.citySubdivision || 'Al-Husam')}</cbc:CitySubdivisionName>
                <cbc:CityName>${this.escapeXml(config.cityName || 'Riyadh')}</cbc:CityName>
                <cbc:PostalZone>${this.escapeXml(config.postalCode || '12211')}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${config.countryCode || 'SA'}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${config.vatNumber}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${this.escapeXml(config.taxpayerName)}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
${customerPartyXml}
    <cac:Delivery>
        <cbc:ActualDeliveryDate>${ksaDate}</cbc:ActualDeliveryDate>
    </cac:Delivery>
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>${data.paymentMeansCode || '10'}</cbc:PaymentMeansCode>
        ${
          data.transactionType === 'credit_note_381' || data.transactionType === 'debit_note_383'
            ? `<cbc:InstructionNote>${this.escapeXml(data.billingReferenceId ? `Amendment for invoice ${data.billingReferenceId}` : 'Goods returned or cancelled')}</cbc:InstructionNote>`
            : ''
        }
    </cac:PaymentMeans>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${currency}">${totalVat.toFixed(2)}</cbc:TaxAmount>
    </cac:TaxTotal>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${currency}">${totalVat.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${currency}">${totalExclusive.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${currency}">${totalVat.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${currency}">${totalExclusive.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="${currency}">${totalExclusive.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="${currency}">${totalInclusive.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PrepaidAmount currencyID="${currency}">0.00</cbc:PrepaidAmount>
        <cbc:PayableAmount currencyID="${currency}">${totalInclusive.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>`;

    const hashData = ZatcaCryptoHelper.computeInvoiceHash(xml);

    return {
      xml,
      invoiceHash: hashData.hash,
    };
  }

  private escapeXml(unsafe: string): string {
    return (unsafe || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
