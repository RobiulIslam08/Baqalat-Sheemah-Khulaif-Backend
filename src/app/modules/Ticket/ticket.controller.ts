import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { TicketService } from './ticket.service';

const openTicket = catchAsync(async (req, res) => {
  const result = await TicketService.openTicket(req.body, req.user.userId);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Ticket created successfully', data: result });
});

const getTickets = catchAsync(async (req, res) => {
  const result = await TicketService.getTickets(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Tickets retrieved', meta: result.meta, data: result.data });
});

const updateTicketStatus = catchAsync(async (req, res) => {
  const result = await TicketService.updateTicketStatus(req.params.id, req.body);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Ticket updated', data: result });
});

export const TicketController = { openTicket, getTickets, updateTicketStatus };
