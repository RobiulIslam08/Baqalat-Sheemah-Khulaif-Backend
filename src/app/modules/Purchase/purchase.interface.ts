import { Types } from 'mongoose';

export interface IPurchaseItem {
  barcode?: string;
  itemName: string;
  batch?: string;
  expiryDate?: Date;
  totalQty: number;
  free: number;
  sellingPrice: number;
  discountAmt: number;
  discountPercent: number;
  purchasePrice: number;
  netAmount: number;
}

export interface IPurchase {
  invoiceNo: string;
  invoiceDate: Date;
  supplier?: Types.ObjectId | string;
  purchaseOrderNo?: string;
  items: IPurchaseItem[];
  netAmount: number;
  discount: number;
  vat: number;
  totalAmount: number;
  paymentMethod: 'readyCash' | 'creditCard';
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}
