import { fontBytes, boldFontBytes, extractPdfText } from './pdf-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { appendReferenceNotes } from '../src/reference-render.mjs';

test('annotated export retains complete long notes in a readable appendix', async () => {
  const pdf = new jsPDF();
  const text = `Rose à mão\n${'A long reference note with detail. '.repeat(45)}\nEND OF NOTE`;
  const added = await appendReferenceNotes(pdf, [{ page: 2, text }], { locale: 'en', fontBytes, boldFontBytes });
  assert.ok(added >= 1);
  const result = await extractPdfText(new Uint8Array(pdf.output('arraybuffer')));
  assert.ok(result.includes('Reference notes'));
  assert.ok(result.includes('Rose à mão'));
  assert.ok(result.includes('END OF NOTE'));
  assert.equal(await appendReferenceNotes(pdf, [{ page: 2, text: '' }]), 0);
});

test('the appendix observes the total PDF page bound', async () => {
  await assert.rejects(() => appendReferenceNotes(new jsPDF(), [{ page: 1, text: 'A note' }], { maxPages: 1, fontBytes, boldFontBytes }), error => error.code === 'reference_export_limit');
});
