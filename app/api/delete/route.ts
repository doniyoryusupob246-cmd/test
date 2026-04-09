import prisma from '@/lib/prisma';

export async function GET() {
  await prisma.listing.deleteMany();

  return Response.json({ message: 'Deleted' });
}
