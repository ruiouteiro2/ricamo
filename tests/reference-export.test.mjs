import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { appendReferenceNotes } from '../src/reference-render.mjs';

test('annotated export retains complete long notes in a readable appendix', () => {
  const pdf = new jsPDF();
  const text = `Rose outline\n${'A long reference note with detail. '.repeat(45)}\nEND OF NOTE`;
  const added = appendReferenceNotes(pdf, [{ page: 2, text }], { locale: 'en' });
  assert.ok(added >= 1);
  const result = pdf.output();
  assert.ok(result.includes('Reference notes'));
  assert.ok(result.includes('Rose outline'));
  assert.ok(result.includes('END OF NOTE'));
  assert.equal(appendReferenceNotes(pdf, [{ page: 2, text: '' }]), 0);
});

test('the appendix observes the total PDF page bound', () => {
  assert.throws(() => appendReferenceNotes(new jsPDF(), [{ page: 1, text: 'A note' }], { maxPages: 1 }), error => error.code === 'reference_export_limit');
});
