import httpStatus from 'http-status';
import { Ticket } from './ticket.model';
import { ITicket } from './ticket.interface';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../utils/QueryBuilder';
import { generateVoucherId } from '../../utils/generateId';

const openTicket = async (payload: ITicket, userId: string) => {
  payload.createdBy = userId;
  payload.ticketNo = await generateVoucherId(Ticket, 'ticketNo', 'TKT');
  payload.status = 'Open';
  return await Ticket.create(payload);
};

const getTickets = async (query: Record<string, unknown>) => {
  const ticketQuery = new QueryBuilder(Ticket.find(), query)
    .search(['ticketNo', 'subject', 'section']).filter().sort().paginate();
  const result = await ticketQuery.modelQuery;
  const meta = await ticketQuery.countTotal();
  return { meta, data: result };
};

const updateTicketStatus = async (id: string, payload: Partial<ITicket>) => {
  const ticket = await Ticket.findById(id);
  if (!ticket) throw new AppError(httpStatus.NOT_FOUND, 'Ticket not found');
  if (payload.status) ticket.status = payload.status;
  if (payload.priority) ticket.priority = payload.priority;
  await ticket.save();
  return ticket;
};

export const TicketService = { openTicket, getTickets, updateTicketStatus };
