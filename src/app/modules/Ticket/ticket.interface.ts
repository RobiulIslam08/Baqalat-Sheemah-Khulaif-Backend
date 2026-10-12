export interface ITicket {
  ticketNo: string;
  subject: string;
  section: string;
  priority: 'Low' | 'Normal' | 'High' | 'Critical';
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}
