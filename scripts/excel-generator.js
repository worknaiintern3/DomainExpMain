const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colName(index) {
  let name = '';
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode((n % 26) + 65) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

/**
 * Creates an OpenXML Spreadsheet (.xlsx) file
 * @param {string} outputPath Target .xlsx file path
 * @param {Array<{name: string, rows: Array<Array<any>>}>} sheets
 */
function createXlsx(outputPath, sheets) {
  const tempDir = path.join(os.tmpdir(), 'xlsx_' + Math.random().toString(36).substring(2, 9));
  fs.mkdirSync(tempDir, { recursive: true });

  const xlDir = path.join(tempDir, 'xl');
  const wsDir = path.join(xlDir, 'worksheets');
  const relsDir = path.join(tempDir, '_rels');
  const xlRelsDir = path.join(xlDir, '_rels');

  fs.mkdirSync(wsDir, { recursive: true });
  fs.mkdirSync(relsDir, { recursive: true });
  fs.mkdirSync(xlRelsDir, { recursive: true });

  // 1. [Content_Types].xml
  let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`;
  sheets.forEach((_, idx) => {
    contentTypes += `\n  <Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  });
  contentTypes += '\n</Types>';
  fs.writeFileSync(path.join(tempDir, '[Content_Types].xml'), contentTypes, 'utf8');

  // 2. _rels/.rels
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  fs.writeFileSync(path.join(relsDir, '.rels'), rootRels, 'utf8');

  // 3. xl/workbook.xml
  let workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>`;
  sheets.forEach((sheet, idx) => {
    workbook += `\n    <sheet name="${escapeXml(sheet.name.substring(0, 31))}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`;
  });
  workbook += '\n  </sheets>\n</workbook>';
  fs.writeFileSync(path.join(xlDir, 'workbook.xml'), workbook, 'utf8');

  // 4. xl/_rels/workbook.xml.rels
  let workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  sheets.forEach((_, idx) => {
    workbookRels += `\n  <Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`;
  });
  workbookRels += `\n  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  fs.writeFileSync(path.join(xlRelsDir, 'workbook.xml.rels'), workbookRels, 'utf8');

  // 5. xl/styles.xml (Header styling & borders)
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><name val="Calibri"/><sz val="11"/></font>
    <font><b/><color rgb="FFFFFFFF"/><name val="Calibri"/><sz val="11"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E40AF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
  </cellXfs>
</styleSheet>`;
  fs.writeFileSync(path.join(xlDir, 'styles.xml'), styles, 'utf8');

  // 6. xl/worksheets/sheetN.xml
  sheets.forEach((sheet, idx) => {
    let ws = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>`;

    sheet.rows.forEach((row, rowIdx) => {
      const rNum = rowIdx + 1;
      const isHeader = rowIdx === 0;
      const sAttr = isHeader ? ' s="1"' : ' s="0"';
      ws += `\n    <row r="${rNum}">`;
      row.forEach((cellVal, colIdx) => {
        const cellRef = colName(colIdx) + rNum;
        if (cellVal === null || cellVal === undefined || cellVal === '') {
          ws += `<c r="${cellRef}"${sAttr}/>`;
        } else if (typeof cellVal === 'number') {
          ws += `<c r="${cellRef}"${sAttr}><v>${cellVal}</v></c>`;
        } else {
          ws += `<c r="${cellRef}" t="inlineStr"${sAttr}><is><t>${escapeXml(cellVal)}</t></is></c>`;
        }
      });
      ws += '</row>';
    });

    ws += '\n  </sheetData>\n</worksheet>';
    fs.writeFileSync(path.join(wsDir, `sheet${idx + 1}.xml`), ws, 'utf8');
  });

  // Package into zip using PowerShell ZipFile
  const normalizedTemp = tempDir.replace(/\\/g, '/');
  const normalizedOut = outputPath.replace(/\\/g, '/');
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  const psCommand = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${normalizedTemp}', '${normalizedOut}')`;
  execSync(`powershell -NoProfile -Command "${psCommand}"`, { stdio: 'inherit' });

  // Clean up temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });
}

module.exports = { createXlsx };
