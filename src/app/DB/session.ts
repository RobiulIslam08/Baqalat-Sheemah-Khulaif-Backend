import { AsyncLocalStorage } from 'async_hooks';
import mongoose, { ClientSession } from 'mongoose';

const sessions = new AsyncLocalStorage<ClientSession>();

export function currentSession(): ClientSession | undefined {
  return sessions.getStore();
}

export async function startSession() {
  const session = await mongoose.startSession();
  let settled = false;

  const close = async (commit: boolean) => {
    if (settled) return;
    settled = true;
    try {
      if (session.inTransaction()) {
        if (commit) await session.commitTransaction();
        else await session.abortTransaction();
      }
    } finally {
      await session.endSession();
    }
  };

  return {
    async startTransaction() {
      session.startTransaction();
      sessions.enterWith(session);
    },
    async commitTransaction() {
      await close(true);
    },
    async abortTransaction() {
      await close(false);
    },
    endSession() {
      if (!settled) void close(false);
    },
  };
}
