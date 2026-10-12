export interface ISupplierCredit {
  supplier: string;
  invoiceNo: string;
  dueAmount: number;
  paidAmount: number;
  remaining: number;
  paymentDate: Date;
  paymentMethod: 'Cash' | 'Card' | 'Bank Transfer';
  reference?: string;
  remarks?: string;
  status: 'Pending Approval' | 'Settled';
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICustomerCredit {
  customer: string;
  billNo: string;
  dueAmount: number;
  receivedAmount: number;
  remaining: number;
  paymentDate: Date;
  remarks?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}
