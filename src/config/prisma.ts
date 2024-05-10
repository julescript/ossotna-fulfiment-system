import { Prisma, PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ['error', 'info', 'query', 'warn'],
      errorFormat: 'minimal',
    });
  }
  return prisma;
};

prisma = getPrismaClient();

export default prisma;

export const createTransaction = async <T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> =>
  await prisma.$transaction<T>(async (tx) => await callback(tx), {
    maxWait: 60000,
    timeout: 120000,
  });
