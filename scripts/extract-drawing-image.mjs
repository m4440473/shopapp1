import { readFile, writeFile } from 'node:fs/promises';

import OpenAI from 'openai';

const [, , requestPath, resultPath] = process.argv;
const readStandardInput = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};
const request = JSON.parse(requestPath ? await readFile(requestPath, 'utf8') : await readStandardInput());
if (request.model === '__protocol_test__') {
  process.stdout.write(JSON.stringify({ outputText: String(request.prompt ?? '') }));
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured.');

const imageDataUrl = async (filePath, base64, mimeType) => {
  const encoded = typeof base64 === 'string' && base64 ? base64 : (await readFile(filePath)).toString('base64');
  return `data:${mimeType};base64,${encoded}`;
};
const content = [
  { type: 'input_text', text: request.prompt },
  { type: 'input_image', image_url: await imageDataUrl(request.imagePath, request.imageBase64, request.mimeType), detail: 'high' },
];
if (request.cropPath || request.cropBase64) {
  content.push(
    { type: 'input_text', text: 'Higher-detail bottom-right title-block crop:' },
    { type: 'input_image', image_url: await imageDataUrl(request.cropPath, request.cropBase64, 'image/png'), detail: 'high' },
  );
}

const response = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses.create({
  model: request.model,
  input: [{ role: 'user', content }],
  text: { format: { type: 'json_object' } },
  temperature: 0,
});
const result = JSON.stringify({ outputText: response.output_text || '' });
if (resultPath) await writeFile(resultPath, result);
else process.stdout.write(result);
