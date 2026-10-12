import { Types } from 'mongoose';

export interface ISaleItem {
  code: string;
  productName: string;
  batchCode?: string;
  expiryDate?: Date;
  type: 'SINGLE' | 'BOX';
  quantity: number;
  price: number;
  vat: number;
  total: number;
}

export interface ISale {
  billNo: number;
  customer?: Types.ObjectId | string;
  items: ISaleItem[];
  totalAmount: number;
  discount: number;
  vatPercent: number;
  netAmount: number;
  amountPaid: number;
  balance: number;
  paymentMode: 'CASH' | 'CREDIT CARD';
  createdBy: string;
  isReturn: boolean;
  returnReference?: number; // billNo of original sale for returns
  createdAt?: Date;
  updatedAt?: Date;
}
