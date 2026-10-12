export interface IExpense {
  voucherNo: string;
  expenseDate: Date;
  category: 'Utility' | 'Salary' | 'Rent' | 'Other';
  paidTo: string;
  amount: number;
  vat: number;
  netAmount: number;
  paymentMode: 'Cash' | 'Card' | 'Bank Transfer';
  remarks?: string;
  status: 'Pending' | 'Approved';
  approvedBy?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}
