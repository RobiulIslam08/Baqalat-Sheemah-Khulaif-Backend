export interface ICustomer {
  customerCode: string;
  customerName: string;
  mobile?: string;
  email?: string;
  creditLimit?: number;
  address?: string;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
