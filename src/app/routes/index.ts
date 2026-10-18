import express from 'express';

import { AuthRoutes } from '../modules/Auth/auth.routes';
import { UserRoutes } from '../modules/User/user.routes';
import { ProductRoutes } from '../modules/Product/product.routes';
import { SupplierRoutes } from '../modules/Supplier/supplier.routes';
import { CustomerRoutes } from '../modules/Customer/customer.routes';
import { FormulationRoutes } from '../modules/Formulation/formulation.routes';
import { SaleRoutes } from '../modules/Sale/sale.routes';
import { PurchaseRoutes } from '../modules/Purchase/purchase.routes';
import { ExpenseRoutes } from '../modules/Expense/expense.routes';
import { StockRoutes } from '../modules/Stock/stock.routes';
import { CreditRoutes } from '../modules/Credit/credit.routes';
import { CashAdjustmentRoutes } from '../modules/CashAdjustment/cashAdjustment.routes';
import { BarcodeRoutes } from '../modules/Barcode/barcode.routes';
import { ProductSupplierRoutes } from '../modules/ProductSupplier/productSupplier.routes';
import { ProductLinkRoutes } from '../modules/ProductLink/productLink.routes';
import { SettingsRoutes } from '../modules/Settings/settings.routes';
import { TicketRoutes } from '../modules/Ticket/ticket.routes';
import { BackupRoutes } from '../modules/Backup/backup.routes';
import { LicenseRoutes } from '../modules/License/license.routes';
import { ZatcaRoutes } from '../modules/Zatca/zatca.routes';

const router = express.Router();

const moduleRoutes = [
  { path: '/auth', route: AuthRoutes },
  { path: '/users', route: UserRoutes },
  { path: '/products', route: ProductRoutes },
  { path: '/suppliers', route: SupplierRoutes },
  { path: '/customers', route: CustomerRoutes },
  { path: '/formulations', route: FormulationRoutes },
  { path: '/sales', route: SaleRoutes },
  { path: '/purchases', route: PurchaseRoutes },
  { path: '/expenses', route: ExpenseRoutes },
  { path: '/stock', route: StockRoutes },
  { path: '/credits', route: CreditRoutes },
  { path: '/cash-adjustments', route: CashAdjustmentRoutes },
  { path: '/barcode', route: BarcodeRoutes },
  { path: '/product-suppliers', route: ProductSupplierRoutes },
  { path: '/product-links', route: ProductLinkRoutes },
  { path: '/settings', route: SettingsRoutes },
  { path: '/tickets', route: TicketRoutes },
  { path: '/backup', route: BackupRoutes },
  { path: '/license', route: LicenseRoutes },
  { path: '/zatca', route: ZatcaRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;