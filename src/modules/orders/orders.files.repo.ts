import { prisma } from '@/lib/prisma';

export async function createOrderAttachment(data: Record<string, unknown>) { return prisma.attachment.create(data); }
export async function updateOrderAttachmentStoragePath(attachmentId: string, storagePath: string) { return prisma.attachment.update({ where: { id: attachmentId }, data: { storagePath } }); }
export async function findPartById(partId: string) { return prisma.orderPart.findUnique({ where: { id: partId }, select: { id: true } }); }
export async function listPartAttachments(partId: string) { return prisma.partAttachment.findMany({ where: { partId }, orderBy: { createdAt: 'desc' } }); }
export async function findPartWithOrderInfo(partId: string) { return prisma.orderPart.findUnique({ where: { id: partId }, select: { id: true, orderId: true, order: { select: { orderNumber: true, business: true, customer: { select: { name: true } } } } } }); }
export async function createPartAttachment(data: Record<string, unknown>) { return prisma.partAttachment.create(data); }
export async function findPartAttachment(partId: string, attachmentId: string) { return prisma.partAttachment.findFirst({ where: { id: attachmentId, partId }, select: { id: true } }); }
export async function updatePartAttachment(attachmentId: string, data: Record<string, unknown>) { return prisma.partAttachment.update({ where: { id: attachmentId }, data }); }
export async function updatePartAttachmentStoragePath(attachmentId: string, storagePath: string) { return prisma.partAttachment.update({ where: { id: attachmentId }, data: { storagePath } }); }
export async function deletePartAttachment(attachmentId: string) { return prisma.partAttachment.delete({ where: { id: attachmentId } }); }
