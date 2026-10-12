import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { ExpenseService } from './expense.service';

const postExpense = catchAsync(async (req, res) => {
  const result = await ExpenseService.postExpense(req.body, req.user.userId, req.user.role);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Expense posted successfully', data: result });
});

const getAllExpenses = catchAsync(async (req, res) => {
  const result = await ExpenseService.getAllExpenses(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Expenses retrieved successfully', meta: result.meta, data: result.data });
});

const approveExpense = catchAsync(async (req, res) => {
  const result = await ExpenseService.approveExpense(req.params.id, req.user.userId);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Expense approved successfully', data: result });
});

export const ExpenseController = { postExpense, getAllExpenses, approveExpense };
