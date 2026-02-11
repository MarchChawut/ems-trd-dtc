/**
 * ==================================================
 * Leave Form Component - แบบใบลาป่วย ลาคลอดบุตร ลากิจ
 * ==================================================
 * แสดงแบบฟอร์มการลาตามรูปแบบของหน่วยงานราชการไทย
 */

"use client";

import React, { useRef, useState } from "react";
import { Printer, X, FileDown, Loader2 } from "lucide-react";
import { Leave, LeaveType, User, Holiday } from "@/types";
import { generateLeavePDF } from "./LeaveFormPDF";
import "./pdf-fonts";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

interface LeaveFormProps {
  leave: Leave & { user: User };
  userStats?: {
    pastCount: number;
    pastDays: number;
    currentCount: number;
    currentDays: number;
    totalCount: number;
    totalDays: number;
  };
  holidays?: Holiday[];
  previousLeave?: (Leave & { user: User }) | null;
  userLeaves?: Leave[];
  onClose: () => void;
}

/**
 * คำนวณช่วงปีงบประมาณ (1 ต.ค. - 30 ก.ย.)
 */
function getFiscalYearRange(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  // ถ้าเดือน ต.ค.(9) ขึ้นไป = ปีงบประมาณเริ่มปีนี้
  // ถ้าเดือน ม.ค.(0) - ก.ย.(8) = ปีงบประมาณเริ่มปีก่อน
  const fiscalStartYear = month >= 9 ? year : year - 1;
  return {
    start: new Date(fiscalStartYear, 9, 1), // 1 ต.ค.
    end: new Date(fiscalStartYear + 1, 8, 30), // 30 ก.ย.
  };
}

interface TypeStats {
  pastCount: number;
  pastDays: number;
  currentCount: number;
  currentDays: number;
  totalCount: number;
  totalDays: number;
}

/**
 * แปลประเภทการลาเป็นภาษาไทย
 */
const leaveTypeLabels: Record<LeaveType, { short: string; full: string }> = {
  SICK: { short: "ป่วย", full: "ลาป่วย" },
  PERSONAL: { short: "กิจ", full: "ลากิจ" },
  VACATION: { short: "พักร้อน", full: "ลาพักร้อน" },
  MATERNITY: { short: "คลอดบุตร", full: "ลาคลอดบุตร" },
  ORDINATION: { short: "บวช", full: "ลาบวช" },
  OTHER: { short: "อื่นๆ", full: "ลาอื่นๆ" },
};

/**
 * ฟอร์แมตวันที่เป็นไทย
 */
function formatThaiDate(date: Date | string): {
  day: string;
  month: string;
  year: string;
} {
  const d = new Date(date);
  const day = d.getDate().toString();
  const months = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const month = months[d.getMonth()];
  const year = (d.getFullYear() + 543).toString(); // แปลงเป็นพ.ศ.
  return { day, month, year };
}

/**
 * คำนวณจำนวนวันลา (คืนค่าตัวเลข หน่วยเป็นวัน)
 */
function calculateLeaveDaysNum(
  startDate: Date | string,
  endDate: Date | string,
  isHalfDay: boolean,
  hours?: number | null,
  holidays?: Holiday[],
): number {
  if (hours && hours > 0) {
    return hours <= 3 ? 0.5 : 1; // ลา ≤ 3 ชม. = ครึ่งวัน, > 3 ชม. = 1 วัน
  }
  if (isHalfDay) {
    return 0.5;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const dateStr = current.toISOString().split('T')[0];
      const isOrgHoliday = holidays?.some(h => {
        const hDate = new Date(h.date).toISOString().split('T')[0];
        return hDate === dateStr;
      }) || false;
      if (!isOrgHoliday) {
        count++;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * แสดงผลจำนวนวันลาเป็นข้อความ (รองรับครึ่งวันและชั่วโมง)
 */
function formatLeaveDays(
  days: number,
  hours?: number | null,
  isHalfDay?: boolean,
): string {
  if (hours && hours > 0 && hours <= 3) {
    return "0.5 วัน";
  }
  if (hours && hours > 3 && hours < 8) {
    return "1 วัน";
  }
  if (isHalfDay || days === 0.5) {
    return "0.5 วัน";
  }
  // แสดงทศนิยม 1 ตำแหน่ง
  if (days % 1 !== 0) {
    return `${days.toFixed(1)} วัน`;
  }
  return `${days} วัน`;
}

/**
 * คำนวณจำนวนวันลา (คืนข้อความสำหรับแสดงผล)
 */
function calculateLeaveDays(
  startDate: Date | string,
  endDate: Date | string,
  isHalfDay: boolean,
  hours?: number | null,
  holidays?: Holiday[],
): string {
  const days = calculateLeaveDaysNum(startDate, endDate, isHalfDay, hours, holidays);
  return formatLeaveDays(days, hours, isHalfDay);
}

export default function LeaveForm({
  leave,
  userStats,
  holidays = [],
  previousLeave,
  userLeaves = [],
  onClose,
}: LeaveFormProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // คำนวณสถิติแยกตามประเภทลาในปีงบประมาณ
  const fiscalRange = getFiscalYearRange(new Date(leave.startDate));
  const calcBusinessDays = (l: Leave) =>
    calculateLeaveDaysNum(l.startDate, l.endDate, l.isHalfDay, l.hours, holidays);

  const currentLeaveDaysNum = calcBusinessDays(leave);

  const computeTypeStats = (type: string): TypeStats => {
    // ลาก่อนหน้า (ไม่รวมใบลาปัจจุบัน) ในปีงบประมาณเดียวกัน
    const pastLeaves = userLeaves.filter(
      (l) =>
        l.id !== leave.id &&
        l.type === type &&
        new Date(l.startDate) >= fiscalRange.start &&
        new Date(l.startDate) <= fiscalRange.end &&
        (l.status === 'APPROVED' || l.status === 'PENDING')
    );
    const pastCount = pastLeaves.length;
    const pastDays = pastLeaves.reduce((sum, l) => sum + calcBusinessDays(l), 0);

    const currentCount = leave.type === type ? 1 : 0;
    const currentDays = leave.type === type ? currentLeaveDaysNum : 0;

    return {
      pastCount,
      pastDays: Math.round(pastDays * 100) / 100,
      currentCount,
      currentDays: Math.round(currentDays * 100) / 100,
      totalCount: pastCount + currentCount,
      totalDays: Math.round((pastDays + currentDays) * 100) / 100,
    };
  };

  const sickStats = computeTypeStats('SICK');
  const personalStats = computeTypeStats('PERSONAL');
  const maternityStats = computeTypeStats('MATERNITY');

  // ฟอร์แมตจำนวนวันในตารางสถิติ (รองรับครึ่งวัน/ชม.)
  const fmtDays = (days: number): string => {
    if (days === 0) return "0";
    if (days % 1 === 0) return `${days}`;
    return days.toFixed(1);
  };

  // ค่าเริ่มต้นสำหรับ userStats (backward compat)
  const stats = userStats || {
    pastCount: 0,
    pastDays: 0,
    currentCount: 1,
    currentDays: currentLeaveDaysNum || 1,
    totalCount: 1,
    totalDays: currentLeaveDaysNum || 1,
  };

  const startDate = formatThaiDate(leave.startDate);
  const endDate = formatThaiDate(leave.endDate);
  const currentDate = formatThaiDate(new Date());
  const leaveDays = calculateLeaveDays(
    leave.startDate,
    leave.endDate,
    leave.isHalfDay,
    leave.hours,
    holidays,
  );

  // ข้อมูลการลาครั้งก่อน
  const prevLeaveDate = previousLeave ? formatThaiDate(previousLeave.startDate) : null;
  const prevLeaveEndDate = previousLeave ? formatThaiDate(previousLeave.endDate) : null;
  const prevLeaveDays = previousLeave
    ? calculateLeaveDays(previousLeave.startDate, previousLeave.endDate, previousLeave.isHalfDay, previousLeave.hours, holidays)
    : null;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>แบบใบลา - ${leave.user.name}</title>
        <style>
          @page { size: A4; margin: 0; }
          @font-face {
            font-family: 'THSarabun';
            src: url('/fonts/THSarabun.ttf') format('truetype');
          }

          body { 
            font-family: 'THSarabun', sans-serif;
            font-size: 16pt; 
            line-height: 1.2;
            margin: 0;
            padding: 0;
          }
          .form-container { 
            width: 210mm; 
            min-height: auto;
            padding: 15mm 20mm 10mm 30mm;
            box-sizing: border-box;
            page-break-inside: avoid;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        </style>
      </head>
      <body>
        <div class="form-container">
          ${printContent.innerHTML}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleExportPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const blob = await generateLeavePDF(leave, stats);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `leave_form_${leave.user.username}_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("เกิดข้อผิดพลาดในการสร้าง PDF");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const leaveTypeLabel = leaveTypeLabels[leave.type];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            แบบใบลา (พิมพ์/Export PDF)
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              {isGeneratingPDF ? "กำลังสร้าง PDF..." : "Export PDF"}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              พิมพ์
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
              ปิด
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="overflow-auto p-6 bg-gray-100">
          <div
            ref={printRef}
            className="bg-white shadow-sm mx-auto"
            style={{
              width: "210mm",
              minHeight: "297mm",
              padding: "15mm 20mm 10mm 30mm",
              boxSizing: "border-box",
              fontFamily: "THSarabun",
              fontSize: "16pt",
              lineHeight: 1.2,
            }}
          >
            {/* ส่วนหัว */}
            <div style={{ textAlign: "center", marginBottom: "3mm" }}>
              <div style={{ fontSize: "18pt", fontWeight: "bold" }}>
                แบบใบลาป่วย ลาคลอดบุตร ลากิจ
              </div>
            </div>

            {/* เขียนที่ + วันที่ */}
            <div
              style={{
                textAlign: "right",
                fontSize: "16pt",
                marginBottom: "2mm",
              }}
            >
              <div style={{ marginBottom: "1mm" }}>
                เขียนที่
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "80mm",
                    textAlign: "center",
                  }}
                >
                  ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง
                </span>
              </div>
              <div>
                วันที่
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "10mm",
                    textAlign: "center",
                  }}
                >
                  {currentDate.day}
                </span>
                เดือน
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "25mm",
                    textAlign: "center",
                  }}
                >
                  {currentDate.month}
                </span>
                พ.ศ.
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "15mm",
                    textAlign: "center",
                  }}
                >
                  {currentDate.year}
                </span>
              </div>
            </div>

            {/* เรื่อง + เรียน */}
            <div style={{ fontSize: "16pt" }}>
              <div style={{ display: "flex", marginBottom: "1mm" }}>
                <span style={{ whiteSpace: "nowrap" }}>เรื่อง</span>
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    flex: 1,
                    marginLeft: "2mm",
                    paddingLeft: "1mm",
                  }}
                >
                  ขออนุญาต{leaveTypeLabel.full}
                </span>
              </div>
              <div style={{ display: "flex", marginBottom: "2mm" }}>
                <span style={{ whiteSpace: "nowrap" }}>เรียน</span>
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    flex: 1,
                    marginLeft: "2mm",
                    paddingLeft: "1mm",
                  }}
                >
                  ผู้อำนวยการกองการศึกษา วิจัย และพัฒนา
                </span>
              </div>

              {/* ข้าพเจ้า + ตำแหน่ง */}
              <div
                style={{
                  display: "flex",
                  paddingLeft: "10mm",
                  marginBottom: "1mm",
                }}
              >
                <span style={{ whiteSpace: "nowrap" }}>ข้าพเจ้า</span>
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    flex: 1,
                    marginLeft: "1mm",
                    textAlign: "center",
                  }}
                >
                  {leave.user.name}
                </span>
                <span style={{ whiteSpace: "nowrap", marginLeft: "1mm" }}>
                  ตำแหน่ง
                </span>
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    flex: 1,
                    marginLeft: "1mm",
                    textAlign: "center",
                  }}
                >
                  {leave.user.position || ""}
                </span>
              </div>

              {/* กอง + สังกัด */}
              <div style={{ paddingLeft: "0mm", marginBottom: "2mm" }}>
                <span>กอง</span>
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "60mm",
                    textAlign: "center",
                  }}
                >
                  กองการศึกษา วิจัย และพัฒนา
                </span>
                <span style={{ marginLeft: "5mm" }}>สังกัด</span>
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "80mm",
                    textAlign: "center",
                  }}
                >
                  ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง
                </span>
              </div>

              {/* ขอลา: ป่วย / กิจ / คลอดบุตร */}
              <div style={{ marginBottom: "1mm", paddingLeft: "15mm" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    marginRight: "5mm",
                    fontWeight: leave.type === "SICK" ? "bold" : "normal",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "3mm",
                      height: "3mm",
                      marginRight: "1.5mm",
                      borderRadius: "50%",
                      border: "1px solid black",
                      backgroundColor:
                        leave.type === "SICK" ? "black" : "transparent",
                    }}
                  />
                  ป่วย
                </span>
              </div>
              <div style={{ display: "flex", marginBottom: "1mm" }}>
                <span style={{ marginRight: "4mm", whiteSpace: "nowrap" }}>
                  ขอลา
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    marginLeft: "3mm",
                    marginRight: "3mm",
                    fontWeight: leave.type === "PERSONAL" ? "bold" : "normal",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "3mm",
                      height: "3mm",
                      marginRight: "1.5mm",
                      borderRadius: "50%",
                      border: "1px solid black",
                      backgroundColor:
                        leave.type === "PERSONAL" ? "black" : "transparent",
                    }}
                  />
                  กิจ
                </span>
                <span
                  style={{
                    whiteSpace: "nowrap",
                    marginLeft: "8mm",
                    marginRight: "2mm",
                  }}
                >
                  เนื่องจาก
                </span>
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    flex: 1,
                    textAlign: "center",
                  }}
                >
                  {leave.type === "PERSONAL" ? leave.reason : ""}
                </span>
              </div>
              <div style={{ marginBottom: "2mm", paddingLeft: "15mm" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    fontWeight: leave.type === "MATERNITY" ? "bold" : "normal",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "3mm",
                      height: "3mm",
                      marginRight: "1.5mm",
                      borderRadius: "50%",
                      border: "1px solid black",
                      backgroundColor:
                        leave.type === "MATERNITY" ? "black" : "transparent",
                    }}
                  />
                  คลอดบุตร
                </span>
              </div>

              {/* ตั้งแต่วันที่...ถึงวันที่...มีกำหนด */}
              <div style={{ marginBottom: "1mm" }}>
                ตั้งแต่วันที่
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "8mm",
                    textAlign: "center",
                  }}
                >
                  {startDate.day}
                </span>
                เดือน
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "20mm",
                    textAlign: "center",
                  }}
                >
                  {startDate.month}
                </span>
                พ.ศ.
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "12mm",
                    textAlign: "center",
                  }}
                >
                  {startDate.year}
                </span>
                <span style={{ marginLeft: "" }}>ถึงวันที่</span>
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "8mm",
                    textAlign: "center",
                  }}
                >
                  {endDate.day}
                </span>
                เดือน
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "20mm",
                    textAlign: "center",
                  }}
                >
                  {endDate.month}
                </span>
                พ.ศ.
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "12mm",
                    textAlign: "center",
                  }}
                >
                  {endDate.year}
                </span>
                มีกำหนด
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "12mm",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  {leaveDays}
                </span>
              </div>

              {/* ข้าพเจ้าได้ลา */}
              <div style={{ marginBottom: "2mm" }}>
                ข้าพเจ้าได้ลา
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    margin: "0 3mm",
                    fontWeight: previousLeave?.type === "SICK" ? "bold" : "normal",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "3mm",
                      height: "3mm",
                      marginRight: "1.5mm",
                      borderRadius: "50%",
                      border: "1px solid black",
                      backgroundColor:
                        previousLeave?.type === "SICK" ? "black" : "transparent",
                    }}
                  />
                  ป่วย
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    margin: "0 1mm",
                    fontWeight: previousLeave?.type === "PERSONAL" ? "bold" : "normal",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "3mm",
                      height: "3mm",
                      marginRight: "1.5mm",
                      borderRadius: "50%",
                      border: "1px solid black",
                      backgroundColor:
                        previousLeave?.type === "PERSONAL" ? "black" : "transparent",
                    }}
                  />
                  กิจ
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    margin: "0 3mm",
                    fontWeight: previousLeave?.type === "MATERNITY" ? "bold" : "normal",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "3mm",
                      height: "3mm",
                      marginRight: "1.5mm",
                      borderRadius: "50%",
                      border: "1px solid black",
                      backgroundColor:
                        previousLeave?.type === "MATERNITY" ? "black" : "transparent",
                    }}
                  />
                  คลอดบุตร
                </span>
                ครั้งสุดท้ายตั้งแต่วันที่
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "8mm",
                    textAlign: "center",
                  }}
                >
                  {prevLeaveDate?.day || ""}
                </span>
                เดือน
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "20mm",
                    textAlign: "center",
                  }}
                >
                  {prevLeaveDate?.month || ""}
                </span>
                พ.ศ.
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "12mm",
                    textAlign: "center",
                  }}
                >
                  {prevLeaveDate?.year || ""}
                </span>
              </div>

              {/* ถึงวันที่ + มีกำหนด + ในระหว่างลา */}
              <div style={{ marginBottom: "1mm" }}>
                ถึงวันที่
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "8mm",
                    textAlign: "center",
                  }}
                >
                  {prevLeaveEndDate?.day || ""}
                </span>
                เดือน
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "20mm",
                    textAlign: "center",
                  }}
                >
                  {prevLeaveEndDate?.month || ""}
                </span>
                พ.ศ.
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "12mm",
                    textAlign: "center",
                  }}
                >
                  {prevLeaveEndDate?.year || ""}
                </span>
                มีกำหนด
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "12mm",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  {prevLeaveDays || ""}
                </span>
                ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "20mm",
                  }}
                ></span>
              </div>
              <div style={{ display: "flex", marginBottom: "2mm" }}>
                <span
                  style={{ borderBottom: "0.5pt dotted black", flex: 1 }}
                ></span>
                <span style={{ whiteSpace: "nowrap", margin: "0 2mm" }}>
                  หมายเลขโทรศัพท์
                </span>
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "40mm",
                  }}
                ></span>
              </div>
            </div>

            {/* ลงชื่อผู้ลา */}
            <div
              style={{
                textAlign: "center",
                margin: "8mm 0 8mm 0",
                fontSize: "16pt",
              }}
            >
              <div style={{ marginBottom: "1mm" }}>
                ลงชื่อ
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "55mm",
                  }}
                ></span>
              </div>
              <div style={{ marginLeft: "8mm" }}>
                {"("}{" "}
                <span
                  style={{
                    borderBottom: "0.5pt dotted black",
                    display: "inline-block",
                    minWidth: "50mm",
                    textAlign: "center",
                  }}
                >
                  {leave.user.name}
                </span>{" "}
                {")"}
              </div>
            </div>

            {/* ตารางสถิติ + ความเห็น */}
            <div
              style={{
                display: "flex",
                gap: "5mm",
                alignItems: "flex-start",
                fontSize: "16pt",
              }}
            >
              {/* ฝั่งซ้าย - สถิติ */}
              <div style={{ width: "50%", margin: "1mm auto" }}>
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "16pt",
                    textAlign: "center",
                    marginBottom: "1mm",
                    textDecoration: "underline",
                  }}
                >
                  สถิติการลาในปีงบประมาณนี้
                </div>

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "14pt",
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          border: "0.5pt solid black",
                          padding: "1mm",
                          textAlign: "center",
                          width: "25%",
                        }}
                      >
                        ประเภทลา
                      </th>
                      <th
                        style={{
                          border: "0.5pt solid black",
                          padding: "1mm",
                          textAlign: "center",
                          width: "25%",
                        }}
                      >
                        ลามาแล้ว
                        <br />
                        ครั้ง/วัน
                      </th>
                      <th
                        style={{
                          border: "0.5pt solid black",
                          padding: "1mm",
                          textAlign: "center",
                          width: "25%",
                        }}
                      >
                        ลาครั้งนี้
                        <br />
                        ครั้ง/วัน
                      </th>
                      <th
                        style={{
                          border: "0.5pt solid black",
                          padding: "1mm",
                          textAlign: "center",
                          width: "25%",
                        }}
                      >
                        รวมเป็น
                        <br />
                        ครั้ง/วัน
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      { label: "ป่วย", stats: sickStats },
                      { label: "กิจ", stats: personalStats },
                      { label: "คลอดบุตร", stats: maternityStats },
                    ] as { label: string; stats: TypeStats }[]).map((row) => (
                      <tr key={row.label}>
                        <td
                          style={{
                            border: "0.5pt solid black",
                            padding: "1mm",
                            textAlign: "center",
                          }}
                        >
                          {row.label}
                        </td>
                        <td
                          style={{
                            border: "0.5pt solid black",
                            padding: "1mm",
                            textAlign: "center",
                          }}
                        >
                          {row.stats.pastCount > 0 || row.stats.pastDays > 0
                            ? `${row.stats.pastCount}/${fmtDays(row.stats.pastDays)}`
                            : "-"}
                        </td>
                        <td
                          style={{
                            border: "0.5pt solid black",
                            padding: "1mm",
                            textAlign: "center",
                          }}
                        >
                          {row.stats.currentCount > 0
                            ? `${row.stats.currentCount}/${fmtDays(row.stats.currentDays)}`
                            : "-"}
                        </td>
                        <td
                          style={{
                            border: "0.5pt solid black",
                            padding: "1mm",
                            textAlign: "center",
                          }}
                        >
                          {row.stats.totalCount > 0 || row.stats.totalDays > 0
                            ? `${row.stats.totalCount}/${fmtDays(row.stats.totalDays)}`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* ลงชื่อผู้ตรวจสอบ */}
                {/* ลงชื่อ */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: "8mm",
                    marginBottom: "1mm",
                  }}
                >
                  ลงชื่อ
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "50mm",
                    }}
                  />
                  ผู้ตรวจสอบ
                </div>

                {/* (ชื่อ) */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    paddingLeft: "8mm",
                    marginBottom: "3mm",
                  }}
                >
                  {"("}
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "50mm",
                    }}
                  />
                  {")"}
                </div>

                {/* ตำแหน่ง */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: "3mm",
                  }}
                >
                  ตำแหน่ง
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "55mm",
                    }}
                  />
                </div>
                {/* วันที่ */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  วันที่
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "8mm",
                    }}
                  />
                  /
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "12mm",
                    }}
                  />
                  /
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "16mm",
                    }}
                  />
                </div>
              </div>

              {/* ฝั่งขวา - ความเห็น + คำสั่ง */}
              <div style={{ width: "50%", margin: "1mm auto" }}>
                {/* ความเห็นผู้บังคับบัญชา */}
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "16pt",
                    textDecoration: "underline",
                    marginBottom: "2mm",
                    textAlign: "left",
                  }}
                >
                  ความเห็นของผู้บังคับบัญชา
                </div>

                {/* เส้นความเห็น */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: "3mm",
                  }}
                >
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      width: "90%",
                      height: "5mm",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: "3mm",
                  }}
                >
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      width: "90%",
                      height: "5mm",
                    }}
                  />
                </div>

                {/* ลงชื่อ */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: "1mm",
                  }}
                >
                  ลงชื่อ
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "60mm",
                    }}
                  />
                </div>

                {/* (ชื่อ) */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginLeft: "10mm",
                    marginBottom: "3mm",
                  }}
                >
                  {"("}
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "60mm",
                    }}
                  />
                  {")"}
                </div>

                {/* ตำแหน่ง */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: "3mm",
                  }}
                >
                  ตำแหน่ง
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "60mm",
                    }}
                  />
                </div>

                {/* วันที่ */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  วันที่
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "8mm",
                    }}
                  />
                  /
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "12mm",
                    }}
                  />
                  /
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "16mm",
                    }}
                  />
                </div>

                {/* คำสั่ง */}
                <div
                  style={{
                    marginTop: "6mm",
                    fontWeight: "bold",
                    fontSize: "16pt",
                    marginBottom: "2mm",
                    textDecoration: "underline",
                    textAlign: "left",
                  }}
                >
                  คำสั่ง
                </div>

                {/* ตัวเลือก */}
                <div
                  style={{
                    display: "flex",
                    gap: "8mm",
                    marginBottom: "3mm",
                    alignItems: "center",
                    justifyContent: "flex-start",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "1.5mm",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "3mm",
                        height: "3mm",
                        borderRadius: "50%",
                        border: "1px solid black",
                      }}
                    />
                    อนุญาต
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "1.5mm",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "3mm",
                        height: "3mm",
                        borderRadius: "50%",
                        border: "1px solid black",
                      }}
                    />
                    ไม่อนุญาต
                  </span>
                </div>

                {/* ลงชื่อ */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: "1mm",
                  }}
                >
                  ลงชื่อ
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "60mm",
                    }}
                  />
                </div>

                {/* (ชื่อ) */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginLeft: "10mm",
                    marginBottom: "3mm",
                  }}
                >
                  {"("}
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "60mm",
                    }}
                  />
                  {")"}
                </div>

                {/* ตำแหน่ง */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: "3mm",
                  }}
                >
                  ตำแหน่ง
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "60mm",
                    }}
                  />
                </div>
                {/* <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "75mm" }} /> */}

                {/* วันที่ */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  วันที่
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "8mm",
                    }}
                  />
                  /
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "12mm",
                    }}
                  />
                  /
                  <span
                    style={{
                      borderBottom: "0.5pt dotted black",
                      display: "inline-block",
                      minWidth: "16mm",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
