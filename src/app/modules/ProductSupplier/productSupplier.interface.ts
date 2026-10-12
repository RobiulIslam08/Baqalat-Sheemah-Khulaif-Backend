export interface IProductSupplier {
  productCode: string;
  productName: string;
  supplierName: string;
  purchasePrice?: number;
  sellingPrice?: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
