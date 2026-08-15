import prisma from '@/lib/prisma';

export async function GET() {
  await prisma.notification.deleteMany();

  return Response.json({ message: 'Deleted' });
}
