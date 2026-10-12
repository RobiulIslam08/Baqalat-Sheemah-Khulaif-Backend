export interface ICashAdjustment {
  adjustmentNo: string;
  type: 'In' | 'Out';
  amount: number;
  account: string;
  date: Date;
  remarks?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}
