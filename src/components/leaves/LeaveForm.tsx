/**
 * ==================================================
 * Leave Form Component - แบบใบลาป่วย ลาคลอดบุตร ลากิจ
 * ==================================================
 * แสดงแบบฟอร์มการลาตามรูปแบบของหน่วยงานราชการไทย
 */

"use client";

import React, { useRef } from "react";
import { Printer, X, FileDown } from "lucide-react";
import { Leave, LeaveType, User } from "@/types";
import { cn } from "@/lib/utils";

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
  onClose: () => void;
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
 * คำนวณจำนวนวันลา
 */
function calculateLeaveDays(
  startDate: Date | string,
  endDate: Date | string,
  isHalfDay: boolean,
  hours?: number | null,
): string {
  if (hours && hours > 0) {
    if (hours === 4) return "0.5 วัน";
    if (hours === 8) return "1 วัน";
    return `${hours} ชม.`;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  if (isHalfDay) {
    return "0.5 วัน";
  }

  return `${diffDays} วัน`;
}

export default function LeaveForm({
  leave,
  userStats,
  onClose,
}: LeaveFormProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // ค่าเริ่มต้นสำหรับ userStats
  const stats = userStats || {
    pastCount: 0,
    pastDays: 0,
    currentCount: 1,
    currentDays:
      calculateLeaveDays(
        leave.startDate,
        leave.endDate,
        leave.isHalfDay,
        leave.hours,
      ) || 1,
    totalCount: 1,
    totalDays:
      calculateLeaveDays(
        leave.startDate,
        leave.endDate,
        leave.isHalfDay,
        leave.hours,
      ) || 1,
  };

  const startDate = formatThaiDate(leave.startDate);
  const endDate = formatThaiDate(leave.endDate);
  const currentDate = formatThaiDate(new Date());
  const leaveDays = calculateLeaveDays(
    leave.startDate,
    leave.endDate,
    leave.isHalfDay,
    leave.hours,
  );

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
          body { 
            font-family: 'TH SarabunPSK', 'TH Sarabun New', sans-serif; 
            font-size: 14pt; 
            line-height: 1.2;
            margin: 0;
            padding: 0;
          }
          .form-container { 
            width: 210mm; 
            min-height: 297mm;
            padding: 25mm 20mm 20mm 30mm;
            box-sizing: border-box;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
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

  const handleExportPDF = () => {
    handlePrint();
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
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Export PDF
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
              padding: "25mm 20mm 20mm 30mm",
              boxSizing: "border-box",
              fontFamily: "'TH SarabunPSK', 'TH Sarabun New', sans-serif",
              fontSize: "12pt",
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
            <div style={{ textAlign: "right", fontSize: "12pt", marginBottom: "2mm" }}>
              <div style={{ marginBottom: "1mm" }}>
                เขียนที่
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "80mm", textAlign: "center" }}>
                  ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง
                </span>
              </div>
              <div>
                วันที่
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "10mm", textAlign: "center" }}>
                  {currentDate.day}
                </span>
                เดือน
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "25mm", textAlign: "center" }}>
                  {currentDate.month}
                </span>
                พ.ศ.
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "15mm", textAlign: "center" }}>
                  {currentDate.year}
                </span>
              </div>
            </div>

            {/* เรื่อง + เรียน */}
            <div style={{ fontSize: "14pt" }}>
              <div style={{ display: "flex", marginBottom: "1mm" }}>
                <span style={{ whiteSpace: "nowrap" }}>เรื่อง</span>
                <span style={{ borderBottom: "0.5pt dotted black", flex: 1, marginLeft: "2mm", paddingLeft: "1mm" }}>
                  ขออนุญาต{leaveTypeLabel.full}
                </span>
              </div>
              <div style={{ display: "flex", marginBottom: "2mm" }}>
                <span style={{ whiteSpace: "nowrap" }}>เรียน</span>
                <span style={{ borderBottom: "0.5pt dotted black", flex: 1, marginLeft: "2mm", paddingLeft: "1mm" }}>
                  ผู้อำนวยการกองการศึกษา วิจัย และพัฒนา
                </span>
              </div>

              {/* ข้าพเจ้า + ตำแหน่ง */}
              <div style={{ display: "flex", paddingLeft: "10mm", marginBottom: "1mm" }}>
                <span style={{ whiteSpace: "nowrap" }}>ข้าพเจ้า</span>
                <span style={{ borderBottom: "0.5pt dotted black", flex: 1, marginLeft: "1mm", textAlign: "center" }}>
                  {leave.user.name}
                </span>
                <span style={{ whiteSpace: "nowrap", marginLeft: "1mm" }}>ตำแหน่ง</span>
                <span style={{ borderBottom: "0.5pt dotted black", flex: 1, marginLeft: "1mm", textAlign: "center" }}>
                  {leave.user.position || ""}
                </span>
              </div>

              {/* กอง + สังกัด */}
              <div style={{ paddingLeft: "0mm", marginBottom: "2mm" }}>
                <span>กอง</span>
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "60mm", textAlign: "center" }}>
                  กองการศึกษา วิจัย และพัฒนา
                </span>
                <span style={{ marginLeft: "5mm" }}>สังกัด</span>
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "60mm", textAlign: "center" }}>
                  ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง
                </span>
              </div>

              {/* ขอลา: ป่วย / กิจ / คลอดบุตร */}
              <div style={{ marginBottom: "1mm", paddingLeft: "15mm" }}>
                <span
                  className={cn("inline-flex items-center", leave.type === "SICK" && "font-bold")}
                  style={{ marginRight: "5mm" }}
                >
                  <span
                    className={cn("inline-block rounded-full border border-black", leave.type === "SICK" && "bg-black")}
                    style={{ width: "3mm", height: "3mm", marginRight: "1.5mm" }}
                  />
                  ป่วย
                </span>
              </div>
              <div style={{ display: "flex", marginBottom: "1mm" }}>
                <span style={{ whiteSpace: "nowrap" }}>ขอลา</span>
                <span
                  className={cn("inline-flex items-center", leave.type === "PERSONAL" && "font-bold")}
                  style={{ marginLeft: "3mm", marginRight: "3mm" }}
                >
                  <span
                    className={cn("inline-block rounded-full border border-black", leave.type === "PERSONAL" && "bg-black")}
                    style={{ width: "3mm", height: "3mm", marginRight: "1.5mm" }}
                  />
                  กิจ
                </span>
                <span style={{ whiteSpace: "nowrap", marginRight: "2mm" }}>เนื่องจาก</span>
                <span style={{ borderBottom: "0.5pt dotted black", flex: 1, textAlign: "center" }}>
                  {leave.type === "PERSONAL" ? leave.reason : ""}
                </span>
              </div>
              <div style={{ marginBottom: "2mm", paddingLeft: "15mm" }}>
                <span
                  className={cn("inline-flex items-center", leave.type === "MATERNITY" && "font-bold")}
                >
                  <span
                    className={cn("inline-block rounded-full border border-black", leave.type === "MATERNITY" && "bg-black")}
                    style={{ width: "3mm", height: "3mm", marginRight: "1.5mm" }}
                  />
                  คลอดบุตร
                </span>
              </div>

              {/* ตั้งแต่วันที่...ถึงวันที่...มีกำหนด */}
              <div style={{ marginBottom: "1mm" }}>
                ตั้งแต่วันที่
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "10mm", textAlign: "center" }}>
                  {startDate.day}
                </span>
                เดือน
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "20mm", textAlign: "center" }}>
                  {startDate.month}
                </span>
                พ.ศ.
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "12mm", textAlign: "center" }}>
                  {startDate.year}
                </span>
                <span style={{ marginLeft: "10mm" }}>ถึงวันที่</span>
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "10mm", textAlign: "center" }}>
                  {endDate.day}
                </span>
                เดือน
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "20mm", textAlign: "center" }}>
                  {endDate.month}
                </span>
                พ.ศ.
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "12mm", textAlign: "center" }}>
                  {endDate.year}
                </span>
              </div>
              <div style={{ marginBottom: "1mm", paddingLeft: "60mm" }}>
                มีกำหนด
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "12mm", textAlign: "center", fontWeight: "bold" }}>
                  {leaveDays}
                </span>
                วัน
              </div>

              {/* ข้าพเจ้าได้ลา */}
              <div style={{ marginBottom: "1mm" }}>
                ข้าพเจ้าได้ลา
                <span
                  className={cn("inline-flex items-center", leave.type === "SICK" && "font-bold")}
                  style={{ margin: "0 3mm" }}
                >
                  <span
                    className={cn("inline-block rounded-full border border-black", leave.type === "SICK" && "bg-black")}
                    style={{ width: "3mm", height: "3mm", marginRight: "1.5mm" }}
                  />
                  ป่วย
                </span>
                <span
                  className={cn("inline-flex items-center", leave.type === "PERSONAL" && "font-bold")}
                  style={{ margin: "0 3mm" }}
                >
                  <span
                    className={cn("inline-block rounded-full border border-black", leave.type === "PERSONAL" && "bg-black")}
                    style={{ width: "3mm", height: "3mm", marginRight: "1.5mm" }}
                  />
                  กิจ
                </span>
                <span
                  className={cn("inline-flex items-center", leave.type === "MATERNITY" && "font-bold")}
                  style={{ margin: "0 3mm" }}
                >
                  <span
                    className={cn("inline-block rounded-full border border-black", leave.type === "MATERNITY" && "bg-black")}
                    style={{ width: "3mm", height: "3mm", marginRight: "1.5mm" }}
                  />
                  คลอดบุตร
                </span>
                ครั้งสุดท้ายตั้งแต่วันที่
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "80mm", textAlign: "center" }}></span>
              </div>

              {/* ถึงวันที่ + มีกำหนด + ในระหว่างลา */}
              <div style={{ marginBottom: "1mm" }}>
                ถึงวันที่
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "10mm", textAlign: "center" }}></span>
                <span style={{ marginLeft: "5mm" }}>มีกำหนด</span>
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "10mm", textAlign: "center" }}></span>
                วัน ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "30mm" }}></span>
              </div>
              <div style={{ display: "flex", marginBottom: "2mm" }}>
                <span style={{ borderBottom: "0.5pt dotted black", flex: 1 }}></span>
                <span style={{ whiteSpace: "nowrap", margin: "0 2mm" }}>หมายเลขโทรศัพท์</span>
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "40mm" }}></span>
              </div>
            </div>

            {/* ลงชื่อผู้ลา */}
            <div style={{ textAlign: "center", margin: "6mm 0 8mm 0", fontSize: "14pt" }}>
              <div style={{ marginBottom: "1mm" }}>
                ลงชื่อ
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "55mm" }}></span>
              </div>
              <div style={{ marginLeft: "15mm" }}>
                {"("}{" "}
                <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "50mm", textAlign: "center" }}>
                  {leave.user.name}
                </span>
                {" "}{")"}
              </div>
            </div>

            {/* ตารางสถิติ + ความเห็น */}
            <div style={{ display: "flex", gap: "5mm", alignItems: "flex-start", fontSize: "14pt" }}>
              {/* ฝั่งซ้าย - สถิติ */}
              <div style={{ width: "50%" }}>
                <div style={{ fontWeight: "bold", fontSize: "14pt", textAlign: "left", marginBottom: "2mm", textDecoration: "underline" }}>
                  สถิติการลาในปีงบประมาณนี้
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14pt" }}>
                  <thead>
                    <tr>
                      <th style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center", width: "25%" }}>ประเภทลา</th>
                      <th style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center", width: "25%" }}>ลามาแล้ว<br/>ครั้ง/วัน</th>
                      <th style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center", width: "25%" }}>ลาครั้งนี้<br/>ครั้ง/วัน</th>
                      <th style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center", width: "25%" }}>รวมเป็น<br/>ครั้ง/วัน</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>ป่วย</td>
                      <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>
                        {leave.type === "SICK" ? `${stats.pastCount}/${stats.pastDays}` : ""}
                      </td>
                      <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>
                        {leave.type === "SICK" ? `${stats.currentCount}/${stats.currentDays}` : ""}
                      </td>
                      <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>
                        {leave.type === "SICK" ? `${stats.totalCount}/${stats.totalDays}` : ""}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>กิจ</td>
                      <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>
                        {leave.type === "PERSONAL" ? `${stats.pastCount}/${stats.pastDays}` : ""}
                      </td>
                      <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>
                        {leave.type === "PERSONAL" ? `${stats.currentCount}/${stats.currentDays}` : ""}
                      </td>
                      <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>
                        {leave.type === "PERSONAL" ? `${stats.totalCount}/${stats.totalDays}` : ""}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>คลอดบุตร</td>
                      <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>
                        {leave.type === "MATERNITY" ? `${stats.pastCount}/${stats.pastDays}` : ""}
                      </td>
                      <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>
                        {leave.type === "MATERNITY" ? `${stats.currentCount}/${stats.currentDays}` : ""}
                      </td>
                      <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>
                        {leave.type === "MATERNITY" ? `${stats.totalCount}/${stats.totalDays}` : ""}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* ลงชื่อผู้ตรวจสอบ */}
                <div style={{ marginTop: "4mm" }}>
                  <div style={{ marginBottom: "1mm" }}>
                    ลงชื่อ
                    <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "40mm" }}></span>
                    ผู้ตรวจสอบ
                  </div>
                  <div style={{ marginLeft: "8mm", marginBottom: "1mm" }}>
                    {"("}{" "}
                    <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "35mm" }}></span>
                    {" "}{")"}
                  </div>
                  <div style={{ marginBottom: "1mm" }}>
                    ตำแหน่ง
                    <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "45mm" }}></span>
                  </div>
                  <div>
                    วันที่
                    <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "8mm" }}></span>
                    /
                    <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "8mm" }}></span>
                    /
                    <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "12mm" }}></span>
                  </div>
                </div>
              </div>

              {/* ฝั่งขวา - ความเห็น + คำสั่ง */}
              <div style={{ width: "50%" }}>
                {/* ความเห็นผู้บังคับบัญชา */}
                <div style={{ fontWeight: "bold", fontSize: "14pt", textDecoration: "underline", marginBottom: "2mm" }}>
                  ความเห็นของผู้บังคับบัญชา
                </div>
                <div style={{ borderBottom: "0.5pt dotted black", height: "5mm", marginBottom: "3mm" }}></div>

                <div style={{ marginBottom: "1mm" }}>
                  ลงชื่อ
                  <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "50mm" }}></span>
                </div>
                <div style={{ marginLeft: "8mm", marginBottom: "1mm" }}>
                  {"("}{" "}
                  <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "45mm" }}></span>
                  {" "}{")"}
                </div>
                <div style={{ marginBottom: "1mm" }}>
                  ตำแหน่ง
                  <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "50mm" }}></span>
                </div>
                <div style={{ marginBottom: "4mm" }}>
                  วันที่
                  <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "8mm" }}></span>
                  /
                  <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "8mm" }}></span>
                  /
                  <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "12mm" }}></span>
                </div>

                {/* คำสั่ง */}
                <div style={{ fontWeight: "bold", fontSize: "14pt", marginBottom: "2mm" }}>คำสั่ง</div>
                <div style={{ display: "flex", gap: "8mm", marginBottom: "3mm", alignItems: "center" }}>
                  <span className="inline-flex items-center" style={{ gap: "1.5mm" }}>
                    <span className="inline-block rounded-full border border-black" style={{ width: "3mm", height: "3mm" }}></span>
                    อนุญาต
                  </span>
                  <span className="inline-flex items-center" style={{ gap: "1.5mm" }}>
                    <span className="inline-block rounded-full border border-black" style={{ width: "3mm", height: "3mm" }}></span>
                    ไม่อนุญาต
                  </span>
                </div>

                <div style={{ marginBottom: "1mm" }}>
                  ลงชื่อ
                  <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "50mm" }}></span>
                </div>
                <div style={{ marginLeft: "8mm", marginBottom: "1mm" }}>
                  {"("}{" "}
                  <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "45mm" }}></span>
                  {" "}{")"}
                </div>
                <div style={{ marginBottom: "1mm" }}>
                  ตำแหน่ง
                  <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "50mm" }}></span>
                </div>
                <div>
                  วันที่
                  <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "8mm" }}></span>
                  /
                  <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "8mm" }}></span>
                  /
                  <span style={{ borderBottom: "0.5pt dotted black", display: "inline-block", minWidth: "12mm" }}></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
