/**
 * ==================================================
 * Late Arrival Form Component - แบบขอลงเวลามาปฏิบัติราชการหลังเวลา 08.30 น.
 * ==================================================
 * แบบฟอร์มเฉพาะประเภทการลา "มาสาย" (LATE_ARRIVAL) แยกจากแบบใบลาป่วย/คลอดบุตร/กิจ
 */

"use client";

import React, { useRef, useState } from "react";
import { Printer, X, FileDown, Loader2 } from "lucide-react";
import { Leave, User } from "@/types";
import { formatSignatureName } from "@/lib/utils";
import type { LateArrivalStats } from "./LateArrivalFormPDF";

interface LateArrivalFormProps {
  leave: Leave & { user: User };
  userLeaves?: Leave[];
  onClose: () => void;
}

/**
 * คำนวณช่วงปีงบประมาณ (1 ต.ค. - 30 ก.ย.)
 */
function getFiscalYearRange(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const fiscalStartYear = month >= 9 ? year : year - 1;
  return {
    start: new Date(fiscalStartYear, 9, 1),
    end: new Date(fiscalStartYear + 1, 8, 30),
  };
}

const thaiMonths = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function formatThaiDate(date: Date | string): { day: string; month: string; year: string } {
  const d = new Date(date);
  const day = d.getDate().toString();
  const month = thaiMonths[d.getMonth()];
  const rawYear = d.getFullYear();
  const year = (rawYear > 2500 ? rawYear : rawYear + 543).toString();
  return { day, month, year };
}

// ตัด prefix ที่ระบบแนบไว้ในเหตุผลอัตโนมัติ (ครึ่งวัน/ชม./เวลาออก-เวลากลับ) ออกก่อนแสดงผล
const REASON_PREFIX_RE =
  /^\[(ครึ่งวันเช้า|ครึ่งวันบ่าย|ลา [\d.]+ ชม\.|เวลาออก \d{2}:\d{2} - เวลากลับ \d{2}:\d{2})\]\s*/;

export default function LateArrivalForm({
  leave,
  userLeaves = [],
  onClose,
}: LateArrivalFormProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // สถิติ "ยกเว้นสาย" (อนุมัติ) / "สาย" (ไม่อนุมัติ) ของคำขอ LATE_ARRIVAL ในปีงบประมาณเดียวกัน
  const fiscalRange = getFiscalYearRange(new Date(leave.startDate));
  const computeStatusCount = (status: "APPROVED" | "REJECTED"): { past: number; total: number } => {
    const past = userLeaves.filter(
      (l) =>
        l.id !== leave.id &&
        l.type === "LATE_ARRIVAL" &&
        new Date(l.startDate) >= fiscalRange.start &&
        new Date(l.startDate) <= fiscalRange.end &&
        l.status === status
    ).length;
    const current = leave.type === "LATE_ARRIVAL" && leave.status === status ? 1 : 0;
    return { past, total: past + current };
  };
  const exempt = computeStatusCount("APPROVED");
  const late = computeStatusCount("REJECTED");
  const stats: LateArrivalStats = {
    exemptPast: exempt.past,
    exemptTotal: exempt.total,
    latePast: late.past,
    lateTotal: late.total,
  };

  const documentDate = formatThaiDate(
    (leave as any).createdAt ? new Date((leave as any).createdAt) : new Date()
  );
  const requestDate = formatThaiDate(leave.startDate);
  const reason = (leave.reason || "").replace(REASON_PREFIX_RE, "");
  const sig = formatSignatureName((leave.user as any).prefix, leave.user.name);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>แบบขอลงเวลามาปฏิบัติราชการหลังเวลา 08.30 น. - ${(leave.user as any).prefix || ""}${leave.user.name}</title>
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
      const { generateLateArrivalPDF } = await import("./LateArrivalFormPDF");
      await import("./pdf-fonts");
      const blob = await generateLateArrivalPDF(leave, stats);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `late_arrival_form_${leave.user.username}_${new Date().toISOString().split("T")[0]}.pdf`;
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

  const dotted = (minWidth: string): React.CSSProperties => ({
    borderBottom: "0.5pt dotted black",
    display: "inline-block",
    minWidth,
    textAlign: "center",
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
          แบบขอลงเวลามาปฏิบัติราชการหลังเวลา 08.30 น. (พิมพ์/Export PDF)
          </h2>
          <div className="flex gap-2">
            {/* <button
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
            </button> */}
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
            <div style={{ textAlign: "center", marginBottom: "8mm" }}>
              <div style={{ fontSize: "18pt", fontWeight: "bold" }}>
                แบบขอลงเวลามาปฏิบัติราชการหลังเวลา 08.30 น.
              </div>
            </div>

            {/* เขียนที่ + วันที่ */}
            <div style={{ textAlign: "right", fontSize: "16pt", marginBottom: "8mm" }}>
              <div style={{ marginBottom: "1mm" }}>
                เขียนที่
                <span style={dotted("60mm")}>ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง</span>
              </div>
              <div>
                วันที่<span style={dotted("10mm")}>{documentDate.day}</span>
                เดือน<span style={dotted("24mm")}>{documentDate.month}</span>
                พ.ศ.<span style={dotted("15mm")}>{documentDate.year}</span>
              </div>
            </div>

            {/* เรื่อง + เรียน */}
            <div style={{ fontSize: "16pt" }}>
              <div style={{ display: "flex", marginBottom: "1mm" }}>
                <span style={{ whiteSpace: "nowrap" }}>เรื่อง</span>
                <span style={{ ...dotted("auto"), flex: 1, marginLeft: "2mm", paddingLeft: "1mm", textAlign: "left" }}>
                  ขออนุญาตลงเวลามาปฏิบัติราชการ หลังเวลา 08.30 น. (ยกเว้นสาย)
                </span>
              </div>
              <div style={{ display: "flex", marginBottom: "2mm" }}>
                <span style={{ whiteSpace: "nowrap" }}>เรียน</span>
                <span style={{ ...dotted("auto"), flex: 1, marginLeft: "2mm", paddingLeft: "1mm", textAlign: "left" }}>
                  ผู้อำนวยการกองการศึกษา วิจัย และพัฒนา
                </span>
              </div>

              {/* ข้าพเจ้า + ตำแหน่ง */}
              <div style={{ display: "flex", paddingLeft: "10mm", marginBottom: "1mm" }}>
                <span style={{ whiteSpace: "nowrap" }}>ข้าพเจ้า</span>
                <span style={{ ...dotted("auto"), flex: 1, marginLeft: "1mm" }}>
                  {leave.user.prefix}{leave.user.name}
                </span>
                <span style={{ whiteSpace: "nowrap", marginLeft: "1mm" }}>ตำแหน่ง</span>
                <span style={{ ...dotted("auto"), flex: 1, marginLeft: "1mm" }}>
                  {leave.user.position || ""}
                </span>
              </div>

              {/* ฝ่าย + แผนก */}
              <div style={{ marginBottom: "2mm" }}>
                <span>ฝ่าย</span>
                <span style={dotted("60mm")}>.</span>
                <span style={{ marginLeft: "5mm" }}>แผนก</span>
                <span style={dotted("80mm")}>{leave.user.department || ""}</span>
              </div>

              {/* ศูนย์...ของวันที่ */}
              <div style={{ marginBottom: "1mm" }}>
                กองการศึกษา วิจัย และพัฒนา ศูนย์เทคโนโลยีดิจิทัล ขออนุญาตยกเว้นการลงเวลามาปฏิบัติราชการของวันที่
                <span style={dotted("36mm")}>
                  {requestDate.day} {requestDate.month} {requestDate.year}
                </span>
                <span style={{ marginLeft: "3mm" }}>ขออนุญาตลงเวลามาปฏิบัติราชการ ระหว่างเวลา</span>
                <span style={dotted("20mm")}>{leave.outTime || ""}</span>
                {" - "}
                <span style={dotted("20mm")}>{leave.backTime || ""}</span>
                {" น."}
              </div>

              {/* ระหว่างเวลา */}
              <div style={{ marginBottom: "1mm" }}>
                
                
              </div>

              {/* เนื่องจาก */}
              <div style={{ display: "flex", marginBottom: "3mm" }}>
                <span style={{ whiteSpace: "nowrap" }}>เนื่องจาก</span>
                <span style={{ ...dotted("auto"), flex: 1, marginLeft: "2mm" }}>{reason}</span>
              </div>

              <div style={{ marginBottom: "3mm" }}>
                ทั้งนี้ ในวันดังกล่าว ข้าพเจ้าได้ลงเวลากลับตามปกติ (หลังเวลา 16.30 น.)
              </div>

              {/* <div style={{ textAlign: "center", marginBottom: "4mm" }}>จึงเรียนมาเพื่อโปรดพิจารณา</div> */}
              <div style={{ display: "flex", paddingLeft: "10mm", marginBottom: "10mm" }}>จึงเรียนมาเพื่อโปรดพิจารณา</div>

              {/* ลงชื่อผู้ขอ */}
              <div>
                <div style={{ display: "flex", paddingLeft: "70mm", marginBottom: "1mm" }}>
                  ลงชื่อ
                  <span style={dotted("55mm")}>{sig.linePrefix || ""}</span>
                </div>
                <div style={{ display: "flex", paddingLeft: "77mm", marginBottom: "10mm" }}>
                  (<span style={dotted("55mm")}>{sig.parenName}</span>)
                </div>
              </div>

              {/* เรียน ผู้อำนวยการกอง */}
              <div style={{ marginBottom: "6mm" }}>
                <div>เรียน ผู้อำนวยการกอง</div>
                <div style={{ marginTop: "2mm", display: "flex", paddingLeft: "9mm", marginBottom: "8mm" }}>เพื่อโปรดพิจารณาอนุญาต</div>
                <div style={{ display: "flex", paddingLeft: "10mm", marginBottom: "1mm" }}>
                  (<span style={dotted("60mm")}> </span>)
                </div>
                <div style={{ display: "flex", marginBottom: "1mm" }}>
                  ตำแหน่ง<span style={dotted("60mm")}> </span>
                </div>
                <div style={{ display: "flex", marginBottom: "1mm" }}>
                  วันที่<span style={dotted("10mm")}> </span>
                  เดือน<span style={dotted("25mm")}> </span>
                  พ.ศ.<span style={dotted("15mm")}> </span>
                </div>
              </div>

              {/* สถิติ + คำสั่ง (2 คอลัมน์) */}
              <div style={{ display: "flex", gap: "6mm" }}>
                <div style={{ width: "55%" }}>
                  <div style={{ fontWeight: "bold", textDecoration: "underline", textAlign: "center", marginBottom: "2mm" }}>
                    สถิติในปีงบประมาณนี้
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13pt", marginBottom: "5mm" }}>
                    <thead>
                      <tr>
                        <th style={{ border: "0.5pt solid black", padding: "1mm" }}>ประเภท</th>
                        <th style={{ border: "0.5pt solid black", padding: "1mm" }}>ที่ผ่านมา<br />(ครั้ง)</th>
                        <th style={{ border: "0.5pt solid black", padding: "1mm" }}>รวมครั้งนี้<br />(ครั้ง)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>ยกเว้นสาย</td>
                        <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>{stats.exemptPast}</td>
                        <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>{stats.exemptTotal}</td>
                      </tr>
                      <tr>
                        <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>สาย</td>
                        <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>{stats.latePast}</td>
                        <td style={{ border: "0.5pt solid black", padding: "1mm", textAlign: "center" }}>{stats.lateTotal}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div>
                    <div style={{ marginTop: "2mm", display: "flex", paddingLeft: "5mm", marginBottom: "1mm" }}>
                      ลงชื่อ<span style={dotted("50mm")}> </span> ผู้ตรวจสอบ
                    </div>
                    <div style={{ marginTop: "2mm", display: "flex", paddingLeft: "12mm", marginBottom: "1mm" }}>
                      (<span style={dotted("50mm")}> </span>)
                    </div>
                  </div>
                </div>

                <div style={{ width: "45%", textAlign: "center" }}>
                  <div style={{ marginTop: "12mm", display: "flex", justifyContent: "center", gap: "8mm", marginBottom: "8mm" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "1mm" }}>
                      <span style={{ display: "inline-block", width: "3mm", height: "3mm", borderRadius: "50%", border: "1px solid black" }} />
                      อนุญาต
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "1mm" }}>
                      <span style={{ display: "inline-block", width: "3mm", height: "3mm", borderRadius: "50%", border: "1px solid black" }} />
                      ไม่อนุญาต
                    </span>
                  </div>
                  <div style={{ marginTop: "2mm", display: "flex", paddingLeft: "10mm", marginBottom: "1mm" }}>พ.อ.</div>
                  <div style={{display: "flex", paddingLeft: "6mm", marginBottom: "1mm"}}>
                    (<span style={dotted("55mm")}>ปรียพงศ์&nbsp;&nbsp;สามิภักดิ์</span>)
                  </div>
                  <div style={{display: "flex", paddingLeft: "3mm", marginBottom: "1mm"}}>
                    <span style={dotted("55mm")}>ผู้อำนวยการกองการศึกษา วิจัย และพัฒนา</span>
                  </div>
                  <div style={{ marginTop: "1mm" }}>
                    วันที่<span style={dotted("10mm")}> </span>
                    เดือน<span style={dotted("24mm")}> </span>
                    พ.ศ.<span style={dotted("13mm")}> </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
