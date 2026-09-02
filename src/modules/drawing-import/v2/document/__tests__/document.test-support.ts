import { degrees, PDFDocument, StandardFonts } from 'pdf-lib';

export async function createSyntheticPacket() {
  const document = await PDFDocument.create({ updateMetadata: false });
  const font = await document.embedFont(StandardFonts.Helvetica);
  const first = document.addPage([612, 792]);
  first.drawText('DWG NO PART-100', { x: 360, y: 90, size: 12, font });
  first.drawText('MATERIAL 6061-T6', { x: 360, y: 70, size: 12, font });
  const second = document.addPage([792, 1224]);
  second.setRotation(degrees(90));
  second.drawText('DWG NO PART-200', { x: 500, y: 100, size: 14, font });
  return Buffer.from(await document.save({ useObjectStreams: false, addDefaultPage: false }));
}
