import { ZatcaConfig, ZatcaInvoice } from '../zatca.model';
import { ZatcaServices } from '../zatca.service';

let workerInterval: NodeJS.Timeout | null = null;

/**
 * ZATCA Background Sync Worker:
 * Ensures compliance with ZATCA Phase 2 Rule:
 * "Offline/pending simplified invoices must be reported within 24 hours".
 * Checks periodically for any pending or failed invoices and sequentially reports them.
 */
export const startZatcaSyncWorker = (intervalMinutes = 10) => {
  if (workerInterval) return;

  const runSync = async () => {
    try {
      const activeConfig = await ZatcaConfig.findOne({ status: 'onboarded' });
      if (!activeConfig || !activeConfig.productionCsid) return;

      // Find pending or failed invoices from the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pendingInvoices = await ZatcaInvoice.find({
        branchId: activeConfig.branchId,
        zatcaStatus: { $in: ['pending', 'failed'] },
        createdAt: { $gte: twentyFourHoursAgo },
      })
        .sort({ icv: 1 })
        .limit(20);

      if (pendingInvoices.length === 0) return;

      console.log(
        `[ZATCA Auto-Sync Worker] Found ${pendingInvoices.length} pending/failed invoice(s). Synchronizing with ZATCA server...`
      );

      for (const inv of pendingInvoices) {
        try {
          const res = await ZatcaServices.retryInvoice(inv._id.toString());
          if (res.success) {
            console.log(`[ZATCA Auto-Sync Worker] Successfully reported invoice: ${inv.invoiceNumber}`);
          }
        } catch (err: any) {
          console.warn(
            `[ZATCA Auto-Sync Worker] Notice for invoice ${inv.invoiceNumber}:`,
            err?.message || err
          );
        }
      }
    } catch (workerErr: any) {
      console.warn('[ZATCA Auto-Sync Worker] Execution cycle notice:', workerErr?.message || workerErr);
    }
  };

  // Run first check after 20 seconds of server boot
  setTimeout(() => {
    void runSync();
  }, 20000);

  // Then run every intervalMinutes
  workerInterval = setInterval(() => {
    void runSync();
  }, intervalMinutes * 60 * 1000);

  console.log(`[ZATCA Auto-Sync Worker] Started (polling every ${intervalMinutes} minutes).`);
};
