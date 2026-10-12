export interface ISupplier {
  supplierCode: string;
  supplierName: string;
  contactPerson?: string;
  phone?: string;
  creditLimit?: number;
  address?: string;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
