/**
 * Academic Year Engine for @bu.ac.th
 * Academic Year: 1 August to 31 July
 * e.g., May 2026 is Academic Year 2568, Aug 2026 is Academic Year 2569
 */

export function getAcademicYear(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11: Jan = 0, May = 4, Aug = 7, Dec = 11

  // If before August (index 7), it falls in the previous academic year
  const academicYearCE = month < 7 ? year - 1 : year;

  // Convert to Buddhist Era (BE)
  return academicYearCE + 543;
}

/**
 * Returns a list of years for selection, e.g., for the Archive dropdown filter.
 */
export function getAcademicYearsRange(currentYear: number = getAcademicYear(), count: number = 6): number[] {
  const years: number[] = [];
  for (let i = 0; i < count; i++) {
    const yr = currentYear - i;
    if (yr >= 2564 && yr <= 2567) {
      continue;
    }
    years.push(yr);
  }
  return years;
}

/**
 * Checks if a document's receiveDate falls into a specific Academic Year.
 */
export function isDateInAcademicYear(dateStr: string, targetYear: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return getAcademicYear(d) === targetYear;
}

/**
 * Formats a ISO date string to readable Thai format
 */
export function formatThaiDate(dateStr: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Checks if a document was received more than 7 days ago
 */
export function isReceivedMoreThan7DaysAgo(receivedDateStr: string): boolean {
  if (!receivedDateStr) return false;
  const receivedDate = new Date(receivedDateStr);
  if (isNaN(receivedDate.getTime())) return false;
  
  // Create Date object representing today (at midnight)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Set received date to midnight for pure day calculations
  const received = new Date(receivedDate);
  received.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - received.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays > 7;
}

/**
 * Calculates the number of working days (วันทำการ - Mon to Fri) elapsed between two dates.
 * Excludes weekends (Saturday and Sunday).
 */
export function getWorkingDaysElapsed(startDateStr: string, endDateStr?: string): number {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return 0;

  const end = endDateStr ? new Date(endDateStr) : new Date();
  if (isNaN(end.getTime())) return 0;

  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);

  const target = new Date(end);
  target.setHours(0, 0, 0, 0);

  if (target <= cur) return 0;

  let workingDays = 0;
  cur.setDate(cur.getDate() + 1);
  while (cur <= target) {
    const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return workingDays;
}

/**
 * Checks if a document was received more than 5 working days ago (ล่าช้าเกิน 5 วันทำการ)
 */
export function isReceivedMoreThan5WorkingDaysAgo(receivedDateStr: string): boolean {
  if (!receivedDateStr) return false;
  return getWorkingDaysElapsed(receivedDateStr) > 5;
}

/**
 * Checks if a document was received more than 5 working days ago (ล่าช้าเกิน 5 วันทำการ)
 */
export function isReceivedMoreThan5DaysAgo(receivedDateStr: string): boolean {
  return isReceivedMoreThan5WorkingDaysAgo(receivedDateStr);
}

/**
 * Parses and formats an absolute or legacy ID string to the standardized: 'วพ. XXX/YYYY'
 */
export function formatRiRefNo(id: string | undefined | null, defaultYear?: number | string): string {
  if (!id) return "-";
  
  // Clean string and handle typical typos/legacy formats
  const trimmed = id.trim();
  
  // 1. Matches prefixed forms, e.g., "วพ. 8/2568", "วพ.008/2568", "วพ. 008/2568", "วพ 8/2568"
  const prefixedMatch = trimmed.match(/วพ[\s\.\-]*(\d+)\s*\/\s*(\d+)/i);
  if (prefixedMatch) {
    const seq = parseInt(prefixedMatch[1], 10);
    const yr = prefixedMatch[2];
    const paddedSeq = seq.toString().padStart(3, "0");
    return `วพ. ${paddedSeq}/${yr}`;
  }

  // 2. Matches raw slash forms, e.g., "8/2568", "08/2568", "008/2568", "123/2569"
  const slashMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slashMatch) {
    const seq = parseInt(slashMatch[1], 10);
    const yr = slashMatch[2];
    const paddedSeq = seq.toString().padStart(3, "0");
    return `วพ. ${paddedSeq}/${yr}`;
  }

  // 3. Matches raw number formats e.g., "8", "008"
  const singleNumMatch = trimmed.match(/^(\d+)$/);
  if (singleNumMatch) {
    const seq = parseInt(singleNumMatch[1], 10);
    const paddedSeq = seq.toString().padStart(3, "0");
    const yr = defaultYear || "2568";
    return `วพ. ${paddedSeq}/${yr}`;
  }

  return trimmed;
}

/**
 * Extract and format "เลขที่หนังสือ" (Book / Document Number) for display and export.
 * Returns only explicit external document numbers entered by Admin (d.docNumber or d.bookNumber).
 * NEVER falls back to internal "เลขที่ วพ." (d.number, d.vopId, d.riRefNo).
 */
export function getDisplayBookNumber(d: any): string {
  if (!d) return "-";

  // Check explicit docNumber or bookNumber fields ONLY
  const rawDocNumber = typeof d.docNumber === "string" ? d.docNumber.trim() : "";
  const rawBookNumber = typeof d.bookNumber === "string" ? d.bookNumber.trim() : "";

  const candidate = rawDocNumber || rawBookNumber;

  if (!candidate) return "-";

  // Normalize candidate for comparison with internal วพ. reference numbers
  const candidateNorm = candidate.replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();

  if (!candidateNorm) return "-";

  // Build internal วพ. reference variations to compare against
  const internalVop = typeof d.vopId === "string" ? d.vopId : "";
  const internalRi = typeof d.riRefNo === "string" ? d.riRefNo : "";
  const internalFormatted = formatRiRefNo(internalRi || internalVop || d.number, d.academicYear);

  const normVop = internalVop.replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();
  const normRi = internalRi.replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();
  const normFormatted = internalFormatted.replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();

  // If candidate matches internal วพ. reference number, treat as empty external book number
  if (
    (normFormatted && candidateNorm === normFormatted) ||
    (normVop && candidateNorm === normVop) ||
    (normRi && candidateNorm === normRi)
  ) {
    return "-";
  }

  return candidate;
}

/**
 * Extract numerical sequence number from document reference (e.g. "วพ. 021/2568" -> 21)
 */
export function extractRiSeqNumber(id?: string | null, runningNumber?: number | null): number {
  if (typeof runningNumber === "number" && !isNaN(runningNumber) && runningNumber > 0) {
    return runningNumber;
  }
  if (!id) return 0;
  const trimmed = id.trim();
  const prefixedMatch = trimmed.match(/วพ[\s\.\-]*(\d+)\s*\/\s*(\d+)/i);
  if (prefixedMatch) {
    const seq = parseInt(prefixedMatch[1], 10);
    if (!isNaN(seq)) return seq;
  }
  const slashMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slashMatch) {
    const seq = parseInt(slashMatch[1], 10);
    if (!isNaN(seq)) return seq;
  }
  const singleNumMatch = trimmed.match(/^(\d+)$/);
  if (singleNumMatch) {
    const seq = parseInt(singleNumMatch[1], 10);
    if (!isNaN(seq)) return seq;
  }
  return 0;
}
