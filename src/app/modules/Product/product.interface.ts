export interface IProduct {
  productId: string;
  productCode: string;
  productName: string;
  arabicName?: string;
  quantity: number;
  packageVal?: string;
  vat: number;
  mrp: number;
  purchasePrice: number;
  sellingPrice: number;
  storage?: string;
  minQty: number;
  productType: 'SINGLE' | 'BOX';
  boxQty: number;
  formulation?: string;
  isDeleted: boolean;
  batchCode?: string;
  expiryDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
