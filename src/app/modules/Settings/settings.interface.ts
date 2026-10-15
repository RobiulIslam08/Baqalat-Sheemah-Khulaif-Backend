export interface ISettings {
  storeName: string;
  storeNameAr?: string;
  storeNameEn?: string;
  vatNumber: string;
  invoicePrefix: string;
  defaultPayment: string;
  timezone: string;
  supportContact: string;
  lowStockAlert: number;
  allowNegativeStock: 'yes' | 'no';
  currency: string;
  currencySymbol: string;
  vatPercent: number;
  defaultLanguage: 'en' | 'ar';
  invoiceLanguage?: 'ar' | 'en' | 'both';
  dateLocale: string;
  timeLocale: string;
  receiptHeader?: string;
  receiptFooter?: string;
  storeAddress?: string;
  crNumber?: string;
  logo?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
