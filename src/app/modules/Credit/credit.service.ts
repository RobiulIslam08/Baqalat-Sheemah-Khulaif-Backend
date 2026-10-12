import httpStatus from 'http-status';
import { SupplierCredit, CustomerCredit } from './credit.model';
import { ISupplierCredit, ICustomerCredit } from './credit.interface';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../utils/QueryBuilder';
import { roundMoney } from '../../utils/productStock';

async function openSupplierBalance(invoiceNo: string, supplier: string) {
  const rows = await SupplierCredit.find({ invoiceNo, supplier }).sort('-createdAt');
  if (!rows.length) return null;
  return Number(rows[0].remaining);
}

async function openCustomerBalance(billNo: string, customer: string) {
  const rows = await CustomerCredit.find({ billNo, customer }).sort('-createdAt');
  if (!rows.length) return null;
  return Number(rows[0].remaining);
}

const recordSupplierPayment = async (payload: ISupplierCredit, userId: string, userRole: string) => {
  payload.createdBy = userId;
  const open = await openSupplierBalance(payload.invoiceNo, payload.supplier);
  const due = open == null ? Number(payload.dueAmount) : open;
  if (open != null && due <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This invoice has no open balance');
  }
  if (payload.paidAmount > due) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Paid amount cannot exceed due amount');
  }
  payload.dueAmount = roundMoney(due);
  payload.remaining = roundMoney(due - payload.paidAmount);
  const canClose = userRole === 'admin' || userRole === 'manager' || userRole === 'developer';
  payload.status = payload.remaining === 0 && canClose ? 'Settled' : 'Pending Approval';
  return await SupplierCredit.create(payload);
};

const settleSupplierInvoice = async (id: string) => {
  const credit = await SupplierCredit.findById(id);
  if (!credit) throw new AppError(httpStatus.NOT_FOUND, 'Supplier credit not found');
  if (roundMoney(Number(credit.remaining)) !== 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invoice still has a balance');
  }
  credit.status = 'Settled';
  await credit.save();
  return credit;
};

const getSupplierCredits = async (query: Record<string, unknown>) => {
  const creditQuery = new QueryBuilder(SupplierCredit.find(), query)
    .search(['supplier', 'invoiceNo']).filter().sort().paginate();
  const result = await creditQuery.modelQuery;
  const meta = await creditQuery.countTotal();
  return { meta, data: result };
};

const receiveCustomerPayment = async (payload: ICustomerCredit, userId: string) => {
  payload.createdBy = userId;
  const open = await openCustomerBalance(payload.billNo, payload.customer);
  const due = open == null ? Number(payload.dueAmount) : open;
  if (open != null && due <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This bill has no open balance');
  }
  if (payload.receivedAmount > due) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Received amount cannot exceed due amount');
  }
  payload.dueAmount = roundMoney(due);
  payload.remaining = roundMoney(due - payload.receivedAmount);
  return await CustomerCredit.create(payload);
};

const getCustomerCredits = async (query: Record<string, unknown>) => {
  const creditQuery = new QueryBuilder(CustomerCredit.find(), query)
    .search(['customer', 'billNo']).filter().sort().paginate();
  const result = await creditQuery.modelQuery;
  const meta = await creditQuery.countTotal();
  return { meta, data: result };
};

export const CreditService = {
  recordSupplierPayment, settleSupplierInvoice, getSupplierCredits,
  receiveCustomerPayment, getCustomerCredits,
};
