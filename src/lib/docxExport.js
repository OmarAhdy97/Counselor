/**
 * Exports a letter as a real Word file (.docx), right-to-left, A4, Arabic fonts.
 * The `docx` library is loaded only when the counselor asks for the file.
 */
export async function exportLetterDocx({ org, date, ref, to, subject, body, author, filename }) {
  const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx')

  const FONT = { name: 'Traditional Arabic', hint: 'cs' }
  const run = (text, o = {}) =>
    new TextRun({
      text,
      font: FONT,
      rightToLeft: true,
      size: o.size ?? 30,
      sizeComplexScript: o.size ?? 30,
      bold: !!o.bold,
      boldComplexScript: !!o.bold,
      underline: o.underline ? {} : undefined,
    })
  const para = (children, o = {}) =>
    new Paragraph({
      bidirectional: true,
      alignment: o.align ?? AlignmentType.START, // START is the right edge in a right-to-left paragraph
      spacing: { after: o.after ?? 160, line: o.line ?? 360 },
      children: Array.isArray(children) ? children : [children],
    })

  const bodyParas = String(body || '')
    .split('\n')
    .map((line) => (line.trim() ? para(run(line.trim()), { align: AlignmentType.BOTH, after: 120 }) : para(run(' '), { after: 60 })))

  const doc = new Document({
    creator: author || 'أجندة المستشار',
    title: subject || 'خطاب',
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children: [
          para(run(org || 'هيئة قضايا الدولة', { bold: true, size: 34 }), { align: AlignmentType.CENTER, after: 60 }),
          para(run(`التاريخ: ${date}${ref ? `    -    صادر رقم: ${ref}` : ''}`, { size: 26 }), { align: AlignmentType.CENTER, after: 280 }),
          para(run(`السيد / ${String(to || '……').replace(/^السيد\s*\/?\s*/, '')}`, { bold: true })),
          para(run('تحية طيبة وبعد،،،'), { align: AlignmentType.CENTER, after: 200 }),
          para([run('الموضوع: ', { bold: true }), run(subject || '', { bold: true, underline: true })], { after: 240 }),
          ...bodyParas,
          para(run('وتفضلوا بقبول فائق الاحترام،،،'), { align: AlignmentType.CENTER, after: 360 }),
          para(run('المستشار', { bold: true }), { align: AlignmentType.END, after: 40 }),
          para(run(author || '………………'), { align: AlignmentType.END }),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${String(filename || 'خطاب').replace(/[/\\:*?"<>|]/g, '_').slice(0, 80)}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
