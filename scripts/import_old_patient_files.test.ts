import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import oldPatientFiles from './import_old_patient_files'

const { extractCandidateFilesFromHtml } = oldPatientFiles

describe('extractCandidateFilesFromHtml', () => {
  it('extracts file URLs from patient work HTML', () => {
    const html = `
      <table>
        <tr>
          <td>05/09/2026</td>
          <td><a href="/system/patients/29720/pdfs/relatorio.pdf">relatorio.pdf</a></td>
        </tr>
        <tr>
          <td>06/09/2026</td>
          <td><a data-href="https://cdn.example.com/videos/case-1.mp4">video do caso</a></td>
        </tr>
      </table>
    `

    const files = extractCandidateFilesFromHtml(html)

    assert.deepEqual(
      files.map((file) => file.name),
      ['relatorio.pdf', 'case-1.mp4']
    )
    assert.equal(files[0].url, 'https://ortholab.estheticaligner.com.br/system/patients/29720/pdfs/relatorio.pdf')
    assert.equal(files[1].url, 'https://cdn.example.com/videos/case-1.mp4')
  })
})
