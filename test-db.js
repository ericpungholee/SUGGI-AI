const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.$connect()
    console.log('✅ Database connected!')
    
    const userCount = await prisma.user.count()
    console.log(`Users in database: ${userCount}`)
    
  } catch (error) {
    console.error('❌ Connection failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()