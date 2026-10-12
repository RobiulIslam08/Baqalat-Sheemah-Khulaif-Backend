import express from 'express';
import { ExpenseController } from './expense.controller';
import validateRequest from '../../middleware/validationRequest';
import { ExpenseValidation } from './expense.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.post('/', auth('admin', 'manager', 'cashier'), validateRequest(ExpenseValidation.createExpenseValidationSchema), ExpenseController.postExpense);
router.get('/', auth('admin', 'manager', 'cashier'), ExpenseController.getAllExpenses);
router.patch('/:id/approve', auth('admin', 'manager'), ExpenseController.approveExpense);

export const ExpenseRoutes = router;
