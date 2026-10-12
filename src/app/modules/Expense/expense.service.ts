import httpStatus from 'http-status';
import { Expense } from './expense.model';
import { IExpense } from './expense.interface';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../utils/QueryBuilder';
import { roundMoney } from '../../utils/productStock';

const searchableFields = ['voucherNo', 'paidTo', 'category', 'createdBy'];

const postExpense = async (payload: IExpense, userId: string, userRole: string) => {
  payload.createdBy = userId;
  payload.netAmount = roundMoney(Number(payload.amount) * (1 + (Number(payload.vat) || 0) / 100));
  payload.status = (userRole === 'admin' || userRole === 'manager') ? 'Approved' : 'Pending';
  if (payload.status === 'Approved') {
    payload.approvedBy = userId;
  }

  const existing = await Expense.findOne({ voucherNo: payload.voucherNo });
  if (existing) throw new AppError(httpStatus.CONFLICT, 'Expense voucher already exists');

  return await Expense.create(payload);
};

const getAllExpenses = async (query: Record<string, unknown>) => {
  const expenseQuery = new QueryBuilder(Expense.find(), query)
    .search(searchableFields).filter().sort().paginate().fields();
  const result = await expenseQuery.modelQuery;
  const meta = await expenseQuery.countTotal();
  return { meta, data: result };
};

const approveExpense = async (id: string, userId: string) => {
  const expense = await Expense.findById(id);
  if (!expense) throw new AppError(httpStatus.NOT_FOUND, 'Expense not found');
  if (expense.status === 'Approved') throw new AppError(httpStatus.BAD_REQUEST, 'Expense already approved');

  expense.status = 'Approved';
  expense.approvedBy = userId;
  await expense.save();
  return expense;
};

export const ExpenseService = { postExpense, getAllExpenses, approveExpense };
