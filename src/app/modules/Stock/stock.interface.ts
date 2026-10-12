export interface IStockReturn {
  invoiceNo?: string;
  productCode: string;
  productName: string;
  returnQty: number;
  reason: 'Expired' | 'Damaged';
  remarks?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IStockCorrectionItem {
  code: string;
  productName: string;
  batchCode?: string;
  expiryDate?: Date;
  quantity: number;
  price: number;
  total: number;
}

export interface IStockCorrection {
  items: IStockCorrectionItem[];
  totalAmount: number;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}
