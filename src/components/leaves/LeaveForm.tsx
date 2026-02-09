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
          @page { size: A4; margin: 12mm 15mm; }
          body { 
            font-family: 'Angsana New', 'TH Sarabun New', 'Sarabun', sans-serif; 
            font-size: 16pt; 
            line-height: 1.2;
            margin: 0;
            padding: 0;
          }
          .form-container { width: 100%; max-width: 210mm; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .bold { font-weight: bold; }
          .underline { border-bottom: 1px solid black; display: inline-block; min-width: 30px; padding: 0 3px; }
          .underline-md { border-bottom: 1px solid black; display: inline-block; min-width: 80px; padding: 0 3px; }
          .underline-lg { border-bottom: 1px solid black; display: inline-block; min-width: 120px; padding: 0 3px; }
          .dotted { border-bottom: 1px dotted black; display: inline-block; min-width: 60px; }
          .dotted-md { border-bottom: 1px dotted black; display: inline-block; min-width: 100px; }
          .dotted-lg { border-bottom: 1px dotted black; display: inline-block; min-width: 150px; }
          .radio { 
            display: inline-block; 
            width: 10px; 
            height: 10px; 
            border: 1px solid black; 
            border-radius: 50%; 
            margin-right: 3px;
            vertical-align: middle;
          }
          .radio.checked { background-color: black; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          table, th, td { border: 1px solid black; }
          th, td { padding: 6px 4px; text-align: center; font-size: 11pt; }
          .compact { line-height: 1.3; margin: 4px 0; }
          .mb-1 { margin-bottom: 4px; }
          .mb-2 { margin-bottom: 8px; }
          .mt-1 { margin-top: 4px; }
          .mt-2 { margin-top: 8px; }
          .ml-2 { margin-left: 8px; }
          .ml-4 { margin-left: 16px; }
          .ml-8 { margin-left: 32px; }
          .gap-1 { gap: 4px; }
          .gap-2 { gap: 8px; }
          .inline-flex { display: inline-flex; align-items: center; }
          .whitespace-nowrap { white-space: nowrap; }
          .font-bold { font-weight: bold; }
          .text-sm { font-size: 11pt; }
          .signature-section { margin-top: 20px; }
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
            className="bg-white p-6 shadow-sm"
            style={{
              fontFamily:
                "'Angsana New', 'TH SarabunPSK', 'Sarabun', sans-serif",
              fontSize: "16pt",
              lineHeight: 1.2,
            }}
          >
            {/* ส่วนหัว */}
            <div className="text-center pl-[2cm] pr-[1cm] mt-[1.5cm] mb-[1cm]">
              <h1
                className="text-lg font-bold mb-8"
                style={{ fontSize: "24pt" }}
              >
                แบบใบลาป่วย ลาคลอดบุตร ลากิจ
              </h1>
              <div className="text-right text-sm" style={{ fontSize: "16pt" }}>
                <div className="mb-2">
                  เขียนที่{" "}
                  <span className="border-b border-black inline-block min-w-[150px] px-5">
                    ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง
                  </span>
                </div>
                <div className="mb-4">
                  วันที่{" "}
                  <span className="border-b border-black inline-block min-w-[25px] px-5">
                    {currentDate.day}
                  </span>
                  เดือน{" "}
                  <span className="border-b border-black inline-block min-w-[70px] px-5">
                    {currentDate.month}
                  </span>
                  พ.ศ.{" "}
                  <span className="border-b border-black inline-block min-w-[40px] px-5">
                    {currentDate.year}
                  </span>
                </div>
              </div>
            </div>

            {/* ส่วนเนื้อหา */}
            <div
              className="pl-[2cm] pr-[1cm] text-sm"
              style={{ fontSize: "16pt" }}
            >
              <div className="mb-2 flex gap-2">
                <span className="whitespace-nowrap">เรื่อง</span>
                <span className="border-b border-black flex-1 px-1">
                  ขออนุญาต{leaveTypeLabel.full}
                </span>
              </div>

              <div className="mb-6 flex gap-2">
                <span className="whitespace-nowrap">เรียน</span>
                <span className="border-b border-black flex-1 px-1">
                  ผู้อำนวยการกองการศึกษา วิจัย และพัฒนา
                </span>
              </div>

              <div className="">
                <div className="mb-2 pl-10 flex gap-1">
                  <span className="whitespace-nowrap">ข้าพเจ้า</span>
                  <span className="border-b border-black flex-1 px-5">
                    {leave.user.name}
                  </span>
                  <span className="whitespace-nowrap">ตำแหน่ง</span>
                  <span className="border-b border-black flex-1 px-5">
                    {leave.user.position || ""}
                  </span>
                </div>

                <div className="mb-2">
                  กอง{" "}
                  <span className="border-b border-black inline-block min-w-[180px] px-16">
                    กองการศึกษา วิจัย และพัฒนา
                  </span>
                  สังกัด{" "}
                  <span className="border-b border-black inline-block min-w-[200px] px-12">
                    ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง
                  </span>
                </div>

                {leave.user.positionSecond && (
                  <div className="text-sm">
                    {leave.user.positionSecond === "เจ้าหน้าที่งานในพระองค์" &&
                    leave.user.positionLevel ? (
                      <span>
                        ตำแหน่งรอง: {leave.user.positionSecond} ระดับ{" "}
                        {leave.user.positionLevel}
                      </span>
                    ) : (
                      <span>ตำแหน่งรอง: {leave.user.positionSecond}</span>
                    )}
                  </div>
                )}

                {/* <div className="flex gap-4 ml-2 mt-2">
                  <span className={cn("inline-flex items-center gap-1", leave.type === 'SICK' && "font-bold")}>
                    <span className={cn("w-3 h-3 border border-black rounded-full inline-block", leave.type === 'SICK' && "bg-black")}></span>
                    ป่วย
                  </span>
                  <span className={cn("inline-flex items-center gap-1", leave.type === 'PERSONAL' && "font-bold")}>
                    <span className={cn("w-3 h-3 border border-black rounded-full inline-block", leave.type === 'PERSONAL' && "bg-black")}></span>
                    กิจ เนื่องจาก <span className="border-b border-black inline-block min-w-[100px] px-1">{leave.type === 'PERSONAL' ? leave.reason : ''}</span>
                  </span>
                  <span className={cn("inline-flex items-center gap-1", leave.type === 'MATERNITY' && "font-bold")}>
                    <span className={cn("w-3 h-3 border border-black rounded-full inline-block", leave.type === 'MATERNITY' && "bg-black")}></span>
                    คลอดบุตร
                  </span>
                </div> */}

                <div className="mt-2 mb-2 space-y-1">
                  {/* ป่วย */}
                  <div
                    className={cn(
                      "ml-10 flex items-center gap-2",
                      leave.type === "SICK" && "font-bold",
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 border border-black rounded-full inline-block",
                        leave.type === "SICK" && "bg-black",
                      )}
                    />
                    <span>ป่วย</span>
                  </div>

                  {/* กิจ */}
                  <div
                    className={cn(
                      "flex items-center gap-2",
                      leave.type === "PERSONAL" && "font-bold",
                    )}
                  >
                    <p>ขอลา</p>
                    <span
                      className={cn(
                        "w-4 h-4 border border-black rounded-full inline-block",
                        leave.type === "PERSONAL" && "bg-black",
                      )}
                    />
                    <span className="flex items-baseline gap-1">
                      กิจ
                      <span className="ml-12 px-1">เนื่องจาก</span>
                      <span className="border-b border-black inline-block min-w-[480px] px-4">
                        {leave.type === "PERSONAL" ? leave.reason : ""}
                      </span>
                    </span>
                  </div>

                  {/* คลอดบุตร */}
                  <div
                    className={cn(
                      "ml-10 flex items-center gap-2",
                      leave.type === "MATERNITY" && "font-bold",
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 border border-black rounded-full inline-block",
                        leave.type === "MATERNITY" && "bg-black",
                      )}
                    />
                    <span>คลอดบุตร</span>
                  </div>
                </div>

                <div className="mb-2">
                  ตั้งแต่วันที่
                  <span className="border-b border-black inline-block min-w-[30px] px-3">
                    {startDate.day}
                  </span>
                  เดือน{" "}
                  <span className="border-b border-black inline-block min-w-[70px] px-3">
                    {startDate.month}
                  </span>
                  พ.ศ.{" "}
                  <span className="border-b border-black inline-block min-w-[40px] px-3">
                    {startDate.year}
                  </span>
                  ถึงวันที่
                  <span className="border-b border-black inline-block min-w-[30px] px-3">
                    {endDate.day}
                  </span>
                  เดือน{" "}
                  <span className="border-b border-black inline-block min-w-[70px] px-3">
                    {endDate.month}
                  </span>
                  พ.ศ.{" "}
                  <span className="border-b border-black inline-block min-w-[40px] px-3">
                    {endDate.year}
                  </span>
                  มีกำหนด{" "}
                  <span className="border-b border-black inline-block min-w-[40px] px-3 font-semibold">
                    {leaveDays}
                  </span>{" "}
                </div>

                <div className="flex items-center gap-3 mb-2">
                  <span>ข้าพเจ้าได้ลา</span>
                  {/* ป่วย */}
                  <span
                    className={cn(
                      "flex items-center gap-1",
                      leave.type === "SICK" && "font-bold",
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 border border-black rounded-full inline-block",
                        leave.type === "SICK" && "bg-black",
                      )}
                    />
                    ป่วย
                  </span>
                  {/* กิจ */}
                  <span
                    className={cn(
                      "flex items-center gap-1",
                      leave.type === "PERSONAL" && "font-bold",
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 border border-black rounded-full inline-block",
                        leave.type === "PERSONAL" && "bg-black",
                      )}
                    />
                    กิจ
                  </span>
                  {/* คลอดบุตร */}
                  <span
                    className={cn(
                      "flex items-center gap-1",
                      leave.type === "MATERNITY" && "font-bold",
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 border border-black rounded-full inline-block",
                        leave.type === "MATERNITY" && "bg-black",
                      )}
                    />
                    คลอดบุตร
                  </span>
                  ครั้งสุดท้ายตั้งแต่วันที่
                  <span className="border-b border-black inline-block min-w-[30px] px-3">
                    {startDate.day}
                  </span>
                  เดือน{" "}
                  <span className="border-b border-black inline-block min-w-[70px] px-2">
                    {startDate.month}
                  </span>
                  พ.ศ.{" "}
                  <span className="border-b border-black inline-block min-w-[40px] px-2">
                    {startDate.year}
                  </span>
                </div>

                <div className="mb-2">
                  ถึงวันที่
                  <span className="border-b border-black inline-block min-w-[30px] px-3">
                    {startDate.day}
                  </span>
                  เดือน{" "}
                  <span className="border-b border-black inline-block min-w-[70px] px-3">
                    {startDate.month}
                  </span>
                  พ.ศ.{" "}
                  <span className="border-b border-black inline-block min-w-[40px] px-3">
                    {startDate.year}
                  </span>
                  มีกำหนด{" "}
                  <span className="border-b border-black inline-block min-w-[40px] px-3 font-semibold">
                    {leaveDays}
                  </span>{" "}
                  ในระหว่างลากิจจะติดต่อข้าพเจ้าได้ที่{" "}
                  <span className="border-b border-black inline-block min-w-[75px] px-1"></span>
                </div>
                <div className="mb-12">
                  <span className="border-b border-black inline-block min-w-[400px] px-1"></span>
                  หมายเลขโทรศัพท์{" "}
                  <span className="border-b border-black inline-block min-w-[162px] px-1"></span>
                </div>
              </div>

              {/* ลงชื่อ */}
              <div className="text-center mt-4 mb-12 mr-8">
                <div className="mb-1">
                  ลงชื่อ{" "}
                  <span className="border-b border-black inline-block min-w-[160px] px-1"></span>
                </div>
                <div className="ml-10">
                  (
                  <span className="border-b border-black inline-block min-w-[160px] px-1">
                    {leave.user.name}
                  </span>
                  )
                </div>
              </div>
            </div>

            {/* ตารางสถิติ + ความเห็น */}
            <div className="mt-6 pl-[2cm] pr-[1cm] flex gap-10 items-start">
              {/* ฝั่งซ้าย */}
              <div className="w-[55%]">
                <p className="font-bold text-[16pt] text-center mb-2 underline">
                  สถิติการลาในปีงบประมาณนี้
                </p>

                <table className="w-full border-collapse border border-black text-[16pt]">
                  <thead>
                    <tr>
                      <th className="border border-black p-1">ประเภทลา</th>
                      <th className="border border-black p-1">
                        ที่ผ่านมา
                        <br />
                        (ครั้ง/วัน)
                      </th>
                      <th className="border border-black p-1">
                        ปัจจุบัน
                        <br />
                        (ครั้ง/วัน)
                      </th>
                      <th className="border border-black p-1">
                        สะสม
                        <br />
                        (ครั้ง/วัน)
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td className="border border-black p-1 text-center">
                        ป่วย
                      </td>
                      <td className="border border-black p-1 text-center">
                        {leave.type === "SICK"
                          ? `${stats.pastCount}/${stats.pastDays}`
                          : ""}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {leave.type === "SICK"
                          ? `${stats.currentCount}/${stats.currentDays}`
                          : ""}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {leave.type === "SICK"
                          ? `${stats.totalCount}/${stats.totalDays}`
                          : ""}
                      </td>
                    </tr>

                    <tr>
                      <td className="border border-black p-1 text-center">
                        กิจ
                      </td>
                      <td className="border border-black p-1 text-center">
                        {leave.type === "PERSONAL"
                          ? `${stats.pastCount}/${stats.pastDays}`
                          : ""}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {leave.type === "PERSONAL"
                          ? `${stats.currentCount}/${stats.currentDays}`
                          : ""}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {leave.type === "PERSONAL"
                          ? `${stats.totalCount}/${stats.totalDays}`
                          : ""}
                      </td>
                    </tr>

                    <tr>
                      <td className="border border-black p-1 text-center">
                        คลอดบุตร
                      </td>
                      <td className="border border-black p-1 text-center">
                        {leave.type === "MATERNITY"
                          ? `${stats.pastCount}/${stats.pastDays}`
                          : ""}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {leave.type === "MATERNITY"
                          ? `${stats.currentCount}/${stats.currentDays}`
                          : ""}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {leave.type === "MATERNITY"
                          ? `${stats.totalCount}/${stats.totalDays}`
                          : ""}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ฝั่งขวา */}
              <div className="w-[45%] space-y-6 text-[11pt]">
                {/* ความเห็น */}
                <div>
                  <p className="font-bold text-[16pt] text-left mb-2 underline">ความเห็นผู้บังคับบัญชา</p>

                  <div className="border-b border-dotted border-black h-6 mb-4"></div>

                  <div className="space-y-1">
                    <div>
                      ลงชื่อ
                      <span className="border-b border-dotted border-black inline-block w-[220px] ml-2"></span>
                    </div>

                    <div className="ml-10">
                      (
                      <span className="border-b border-dotted border-black inline-block w-[200px]"></span>
                      )
                    </div>

                    <div>
                      ตำแหน่ง
                      <span className="border-b border-dotted border-black inline-block w-[200px] ml-2"></span>
                    </div>

                    <div>
                      วันที่
                      <span className="border-b border-dotted border-black inline-block w-[40px] ml-2"></span>
                      /
                      <span className="border-b border-dotted border-black inline-block w-[40px] ml-2"></span>
                      /
                      <span className="border-b border-dotted border-black inline-block w-[60px] ml-2"></span>
                    </div>
                  </div>
                </div>

                {/* คำสั่ง */}
                <div>
                  <p className="font-bold mb-2">คำสั่ง</p>

                  <div className="flex gap-10 mb-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-4 h-4 border border-black rounded-full"></span>
                      อนุญาต
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <span className="w-4 h-4 border border-black rounded-full"></span>
                      ไม่อนุญาต
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div>
                      ลงชื่อ
                      <span className="border-b border-dotted border-black inline-block w-[220px] ml-2"></span>
                    </div>

                    <div className="ml-10">
                      (
                      <span className="border-b border-dotted border-black inline-block w-[200px]"></span>
                      )
                    </div>

                    <div>
                      ตำแหน่ง
                      <span className="border-b border-dotted border-black inline-block w-[200px] ml-2"></span>
                    </div>

                    <div>
                      วันที่
                      <span className="border-b border-dotted border-black inline-block w-[40px] ml-2"></span>
                      /
                      <span className="border-b border-dotted border-black inline-block w-[40px] ml-2"></span>
                      /
                      <span className="border-b border-dotted border-black inline-block w-[60px] ml-2"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* หมายเหตุ */}
            <div
              className="mt-4 text-xs text-gray-600"
              style={{ fontSize: "10pt" }}
            >
              <p>
                หมายเหตุ: แบบฟอร์มนี้สร้างโดยระบบ EMS วันที่ {currentDate.day}{" "}
                {currentDate.month} {currentDate.year}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
