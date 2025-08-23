import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

// Ensure no Prisma logging is enabled
if (process.env.DEBUG) {
    delete process.env.DEBUG;
}
if (process.env.PRISMA_LOG_QUERIES) {
    delete process.env.PRISMA_LOG_QUERIES;
}

// Disable console.log for Prisma queries
const originalConsoleLog = console.log;
console.log = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('prisma:query')) {
        return; // Don't log Prisma queries
    }
    originalConsoleLog.apply(console, args);
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: [], // Completely disable all logging
    errorFormat: 'pretty',
    // Additional options to ensure no logging
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
})

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

// Handle connection errors gracefully
prisma.$connect()
    .then(() => {
        // Connection successful - no logging to reduce terminal noise
    })
    .catch((error) => {
        console.error('❌ Database connection failed:', error)
    })

export default prisma