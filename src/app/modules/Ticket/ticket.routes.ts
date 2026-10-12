import express from 'express';
import { TicketController } from './ticket.controller';
import validateRequest from '../../middleware/validationRequest';
import { TicketValidation } from './ticket.validation';
import auth from '../../middleware/auth';

const router = express.Router();

router.post('/', auth('admin', 'manager', 'cashier'), validateRequest(TicketValidation.createTicketValidationSchema), TicketController.openTicket);
router.get('/', auth('admin', 'manager', 'cashier'), TicketController.getTickets);
router.patch('/:id', auth('admin', 'manager'), validateRequest(TicketValidation.updateTicketValidationSchema), TicketController.updateTicketStatus);

export const TicketRoutes = router;
