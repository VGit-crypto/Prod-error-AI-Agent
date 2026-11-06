import ExcelJS from 'exceljs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { GeneratedTestCase } from '../models/testcase.model';

export interface ExcelWriteResult {
  fullPath: string;
}

export interface BugSectionExcelBlock {
  title: string;
  testCases: GeneratedTestCase[];
}

type BorderStyle = ExcelJS.BorderStyle;

export class ExcelWriterService {
  private static readonly DARK_BLUE = '1F4E79';
  private static readonly WHITE = 'FFFFFF';

  async writeBugSectionsWorkbook(
    outputDir: string,
    fileName: string,
    blocks: BugSectionExcelBlock[]
  ): Promise<ExcelWriteResult> {
    const resolvedDir = path.isAbsolute(outputDir)
      ? outputDir
      : path.resolve(process.cwd(), outputDir);

    await mkdir(resolvedDir, { recursive: true });
    const fullPath = path.join(resolvedDir, fileName);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'testcase-generator';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('TestCases');
    this.applyColumnWidths(sheet);

    let rowCursor = 1;

    for (const block of blocks) {
      rowCursor = this.writeBugBlock(sheet, rowCursor, block);
      // Leave ONE empty row between sections
      rowCursor += 1;
    }

    await workbook.xlsx.writeFile(fullPath);
    return { fullPath };
  }

  private writeBugBlock(sheet: ExcelJS.Worksheet, startRow: number, block: BugSectionExcelBlock): number {
    // STEP 1: Title row (merged A:E)
    const titleRowNumber = startRow;
    sheet.mergeCells(titleRowNumber, 1, titleRowNumber, 5);

    const titleCell = sheet.getCell(titleRowNumber, 1);
    titleCell.value = block.title;
    titleCell.font = { bold: true, color: { argb: ExcelWriterService.WHITE } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: ExcelWriterService.DARK_BLUE }
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    const titleRow = sheet.getRow(titleRowNumber);
    titleRow.height = 24;
    this.applyBorderToRange(sheet, titleRowNumber, 1, titleRowNumber, 5, 'medium');

    // STEP 2: Column headers row
    const headerRowNumber = titleRowNumber + 1;
    const headerLabels = ['Test Case ID', 'Scenario', 'Test Steps', 'Expected Result', 'Priority'];

    for (let c = 1; c <= 5; c += 1) {
      const cell = sheet.getCell(headerRowNumber, c);
      cell.value = headerLabels[c - 1];
      cell.font = { bold: true, color: { argb: ExcelWriterService.WHITE } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ExcelWriterService.DARK_BLUE }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
    sheet.getRow(headerRowNumber).height = 20;
    this.applyBorderToRange(sheet, headerRowNumber, 1, headerRowNumber, 5, 'thin');

    // Auto-filter for header row
    sheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: 5 }
    };

    // Freeze panes: keep the current section header visible if possible.
    // Excel supports a single freeze split, so we freeze at this section's header row.
    // This makes sense since the user will typically scroll within a section.
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRowNumber }];

    // STEP 3: Test cases rows
    let rowCursor = headerRowNumber + 1;
    for (const tc of block.testCases) {
      const rowNumber = rowCursor;
      const steps = tc.testSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');

      sheet.getCell(rowNumber, 1).value = tc.testCaseId;
      sheet.getCell(rowNumber, 2).value = tc.scenario;
      sheet.getCell(rowNumber, 3).value = steps;
      sheet.getCell(rowNumber, 4).value = tc.expectedResult;
      sheet.getCell(rowNumber, 5).value = tc.priority;

      // Alignment + wrapping rules
      sheet.getCell(rowNumber, 1).alignment = { vertical: 'top' };
      sheet.getCell(rowNumber, 2).alignment = { vertical: 'top', wrapText: true };
      sheet.getCell(rowNumber, 3).alignment = { vertical: 'top', wrapText: true };
      sheet.getCell(rowNumber, 4).alignment = { vertical: 'top', wrapText: true };
      sheet.getCell(rowNumber, 5).alignment = { vertical: 'top', horizontal: 'center' };

      this.applyBorderToRange(sheet, rowNumber, 1, rowNumber, 5, 'thin');

      // Give enough height for wrapped content
      sheet.getRow(rowNumber).height = 60;
      rowCursor += 1;
    }

    return rowCursor;
  }

  private applyColumnWidths(sheet: ExcelJS.Worksheet): void {
    sheet.getColumn(1).width = 20; // A
    sheet.getColumn(2).width = 50; // B
    sheet.getColumn(3).width = 80; // C
    sheet.getColumn(4).width = 60; // D
    sheet.getColumn(5).width = 15; // E
  }

  private applyBorderToRange(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    style: BorderStyle
  ): void {
    for (let r = startRow; r <= endRow; r += 1) {
      for (let c = startCol; c <= endCol; c += 1) {
        const cell = sheet.getCell(r, c);
        cell.border = {
          top: { style },
          left: { style },
          bottom: { style },
          right: { style }
        };
      }
    }
  }
}
