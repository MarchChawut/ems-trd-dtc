"use client";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  PDFDownloadLink,
} from "@react-pdf/renderer";
import { Leave, LeaveType, User } from "@/types";

// ลงทะเบียนฟอนต์ไทย (Sarabun จาก Google Fonts)
Font.register({
  family: "THSarabun",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/sarabun/v15/DtVjJx26TKEr37c9YL5rilwm.ttf",
      fontWeight: "normal",
    },
    {
      src: "https://fonts.gstatic.com/s/sarabun/v15/DtVmJx26TKEr37c9YNpoulwm6gDX.ttf",
      fontWeight: "bold",
    },
  ],
});

// ปิด hyphenation สำหรับภาษาไทย
Font.registerHyphenationCallback((word) => [word]);

interface LeaveFormPDFProps {
  leave: Leave & { user: User };
  userStats?: {
    pastCount: number;
    pastDays: number;
    currentCount: number;
    currentDays: number;
    totalCount: number;
    totalDays: number;
  };
}

const leaveTypeLabels: Record<LeaveType, { short: string; full: string }> = {
  SICK: { short: "ป่วย", full: "ลาป่วย" },
  PERSONAL: { short: "กิจ", full: "ลากิจ" },
  VACATION: { short: "พักร้อน", full: "ลาพักร้อน" },
  MATERNITY: { short: "คลอดบุตร", full: "ลาคลอดบุตร" },
  ORDINATION: { short: "บวช", full: "ลาบวช" },
  OTHER: { short: "อื่นๆ", full: "ลาอื่นๆ" },
};

const thaiMonths = [
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

function formatThaiDate(date: Date | string) {
  const d = new Date(date);
  return {
    day: d.getDate().toString(),
    month: thaiMonths[d.getMonth()],
    year: (d.getFullYear() + 543).toString(),
  };
}

function calculateLeaveDays(
  startDate: Date | string,
  endDate: Date | string,
  isHalfDay: boolean,
  hours?: number | null,
): string {
  if (hours && hours > 0) {
    if (hours === 4) return "0.5";
    if (hours === 8) return "1";
    return hours.toString();
  }

  if (isHalfDay) return "0.5";

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return diffDays.toString();
}

// สร้าง styles สำหรับ PDF
const styles = StyleSheet.create({
  page: {
    padding: "25 20 20 30",
    fontFamily: "THSarabun",
    fontSize: 16,
    lineHeight: 1.2,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  row: {
    flexDirection: "row",
    marginBottom: 2,
    alignItems: "flex-end",
  },
  rowCenter: {
    flexDirection: "row",
    marginBottom: 2,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  right: {
    textAlign: "right",
    fontSize: 16,
    marginBottom: 2,
  },
  rightRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    marginBottom: 2,
  },
  label: {
    fontSize: 16,
  },
  dottedLine: {
    borderBottom: "0.5 dotted black",
    minWidth: 30,
    textAlign: "center",
    paddingHorizontal: 3,
  },
  dottedLineLong: {
    borderBottom: "0.5 dotted black",
    flex: 1,
    textAlign: "center",
    paddingHorizontal: 3,
  },
  circle: {
    width: 8,
    height: 8,
    border: "0.5 solid black",
    borderRadius: 4,
    marginRight: 4,
  },
  circleFilled: {
    width: 8,
    height: 8,
    border: "0.5 solid black",
    borderRadius: 4,
    backgroundColor: "black",
    marginRight: 4,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  table: {
    width: "100%",
    border: "0.5 solid black",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5 solid black",
  },
  tableHeader: {
    border: "0.5 solid black",
    padding: 3,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "bold",
  },
  tableCell: {
    border: "0.5 solid black",
    padding: 3,
    textAlign: "center",
    fontSize: 14,
  },
  twoColumn: {
    flexDirection: "row",
    gap: 15,
    marginTop: 2,
    fontSize: 16,
  },
  leftColumn: {
    width: "50%",
    marginTop: 2,
  },
  rightColumn: {
    width: "50%",
    marginTop: 2,
  },
  sectionTitle: {
    fontWeight: "bold",
    textDecoration: "underline",
    marginBottom: 5,
    fontSize: 16,
    textAlign: "center",
  },
  sectionTitleLeft: {
    fontWeight: "bold",
    textDecoration: "underline",
    marginBottom: 5,
    fontSize: 16,
    textAlign: "left",
  },
  signSection: {
    marginTop: 8,
    alignItems: "center",
    fontSize: 14,
  },
  leftAlignRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 3,
  },
  fullLine: {
    borderBottom: "0.5 dotted black",
    height: 10,
    marginBottom: 5,
    width: "100%",
  },
});

// PDF Document Component
function LeaveDocument({ leave, userStats }: LeaveFormPDFProps) {
  const startDate = formatThaiDate(leave.startDate);
  const endDate = formatThaiDate(leave.endDate);
  const currentDate = formatThaiDate(new Date());
  const leaveDays = calculateLeaveDays(
    leave.startDate,
    leave.endDate,
    leave.isHalfDay,
    leave.hours,
  );

  const leaveTypeLabel = leaveTypeLabels[leave.type];

  const stats = userStats || {
    pastCount: 0,
    pastDays: 0,
    currentCount: 1,
    currentDays: parseFloat(leaveDays) || 1,
    totalCount: 1,
    totalDays: parseFloat(leaveDays) || 1,
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* หัวเรื่อง */}
        <Text style={styles.title}>แบบใบลาป่วย ลาคลอดบุตร ลากิจ</Text>

        {/* เขียนที่ + วันที่ */}
        <View style={styles.right}>
          <View style={styles.rightRow}>
            <Text style={styles.label}>เขียนที่ </Text>
            <Text style={[styles.dottedLine, { minWidth: 200 }]}>
              ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง
            </Text>
          </View>
          <View style={styles.rightRow}>
            <Text style={styles.label}>วันที่ </Text>
            <Text style={[styles.dottedLine, { minWidth: 25 }]}>
              {currentDate.day}
            </Text>
            <Text style={styles.label}> เดือน </Text>
            <Text style={[styles.dottedLine, { minWidth: 60 }]}>
              {currentDate.month}
            </Text>
            <Text style={styles.label}> พ.ศ. </Text>
            <Text style={[styles.dottedLine, { minWidth: 40 }]}>
              {currentDate.year}
            </Text>
          </View>
        </View>

        {/* เรื่อง + เรียน */}
        <View style={styles.row}>
          <Text style={styles.label}>เรื่อง </Text>
          <Text
            style={[
              styles.dottedLineLong,
              { textAlign: "left", paddingLeft: 3 },
            ]}
          >
            ขออนุญาต{leaveTypeLabel.full}
          </Text>
        </View>
        <View style={[styles.row, { marginBottom: 4 }]}>
          <Text style={styles.label}>เรียน </Text>
          <Text
            style={[
              styles.dottedLineLong,
              { textAlign: "left", paddingLeft: 3 },
            ]}
          >
            ผู้อำนวยการกองการศึกษา วิจัย และพัฒนา
          </Text>
        </View>

        {/* ข้าพเจ้า + ตำแหน่ง */}
        <View style={[styles.row, { paddingLeft: 28 }]}>
          <Text style={styles.label}>ข้าพเจ้า </Text>
          <Text style={[styles.dottedLineLong]}>{leave.user.name}</Text>
          <Text style={styles.label}> ตำแหน่ง </Text>
          <Text style={[styles.dottedLineLong]}>
            {leave.user.position || ""}
          </Text>
        </View>

        {/* กอง + สังกัด */}
        <View style={[styles.row, { marginBottom: 4 }]}>
          <Text style={styles.label}>กอง </Text>
          <Text style={[styles.dottedLine, { minWidth: 160 }]}>
            กองการศึกษา วิจัย และพัฒนา
          </Text>
          <Text style={[styles.label, { marginLeft: 12 }]}> สังกัด </Text>
          <Text style={[styles.dottedLine, { minWidth: 160 }]}>
            ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง
          </Text>
        </View>

        {/* ขอลา: ป่วย (บรรทัดแยก) */}
        <View style={[styles.row, { paddingLeft: 40 }]}>
          <View style={styles.checkboxRow}>
            <View
              style={
                leave.type === "SICK" ? styles.circleFilled : styles.circle
              }
            />
            <Text style={leave.type === "SICK" ? { fontWeight: "bold" } : {}}>
              ป่วย
            </Text>
          </View>
        </View>

        {/* ขอลา กิจ เนื่องจาก */}
        <View style={styles.row}>
          <Text style={styles.label}>ขอลา </Text>
          <View style={[styles.checkboxRow, { marginLeft: 40 }]}>
            <View
              style={
                leave.type === "PERSONAL" ? styles.circleFilled : styles.circle
              }
            />
            <Text
              style={leave.type === "PERSONAL" ? { fontWeight: "bold" } : {}}
            >
              กิจ
            </Text>
          </View>
          <Text style={styles.label}> เนื่องจาก </Text>
          <Text style={[styles.dottedLineLong]}>
            {leave.type === "PERSONAL" ? leave.reason : ""}
          </Text>
        </View>

        {/* คลอดบุตร (บรรทัดแยก) */}
        <View style={[styles.row, { paddingLeft: 40, marginBottom: 4 }]}>
          <View style={styles.checkboxRow}>
            <View
              style={
                leave.type === "MATERNITY" ? styles.circleFilled : styles.circle
              }
            />
            <Text
              style={leave.type === "MATERNITY" ? { fontWeight: "bold" } : {}}
            >
              คลอดบุตร
            </Text>
          </View>
        </View>

        {/* ตั้งแต่วันที่...ถึงวันที่...มีกำหนด (บรรทัดเดียว) */}
        <View style={styles.row}>
          <Text style={styles.label}>ตั้งแต่วันที่ </Text>
          <Text style={[styles.dottedLine, { minWidth: 20 }]}>
            {startDate.day}
          </Text>
          <Text style={styles.label}> เดือน </Text>
          <Text style={[styles.dottedLine, { minWidth: 55 }]}>
            {startDate.month}
          </Text>
          <Text style={styles.label}> พ.ศ. </Text>
          <Text style={[styles.dottedLine, { minWidth: 30 }]}>
            {startDate.year}
          </Text>
          <Text style={styles.label}> ถึงวันที่ </Text>
          <Text style={[styles.dottedLine, { minWidth: 20 }]}>
            {endDate.day}
          </Text>
          <Text style={styles.label}> เดือน </Text>
          <Text style={[styles.dottedLine, { minWidth: 55 }]}>
            {endDate.month}
          </Text>
          <Text style={styles.label}> พ.ศ. </Text>
          <Text style={[styles.dottedLine, { minWidth: 30 }]}>
            {endDate.year}
          </Text>
          <Text style={styles.label}> มีกำหนด </Text>
          <Text
            style={[styles.dottedLine, { minWidth: 30, fontWeight: "bold" }]}
          >
            {leaveDays}
          </Text>
        </View>

        {/* ข้าพเจ้าได้ลา + ครั้งสุดท้ายตั้งแต่วันที่ */}
        <View style={[styles.row, { marginTop: 3 }]}>
          <Text style={styles.label}>ข้าพเจ้าได้ลา </Text>
          <View style={styles.checkboxRow}>
            <View
              style={
                leave.type === "SICK" ? styles.circleFilled : styles.circle
              }
            />
            <Text style={leave.type === "SICK" ? { fontWeight: "bold" } : {}}>
              ป่วย
            </Text>
          </View>
          <View style={[styles.checkboxRow, { marginRight: 3 }]}>
            <View
              style={
                leave.type === "PERSONAL" ? styles.circleFilled : styles.circle
              }
            />
            <Text
              style={leave.type === "PERSONAL" ? { fontWeight: "bold" } : {}}
            >
              กิจ
            </Text>
          </View>
          <View style={styles.checkboxRow}>
            <View
              style={
                leave.type === "MATERNITY" ? styles.circleFilled : styles.circle
              }
            />
            <Text
              style={leave.type === "MATERNITY" ? { fontWeight: "bold" } : {}}
            >
              คลอดบุตร
            </Text>
          </View>
          <Text style={styles.label}> ครั้งสุดท้ายตั้งแต่วันที่ </Text>
          <Text style={[styles.dottedLine, { minWidth: 20 }]}>
            {startDate.day}
          </Text>
          <Text style={styles.label}> เดือน </Text>
          <Text style={[styles.dottedLine, { minWidth: 55 }]}>
            {startDate.month}
          </Text>
          <Text style={styles.label}> พ.ศ. </Text>
          <Text style={[styles.dottedLine, { minWidth: 30 }]}>
            {startDate.year}
          </Text>
        </View>

        {/* ถึงวันที่ + มีกำหนด + ในระหว่างลา */}
        <View style={styles.row}>
          <Text style={styles.label}>ถึงวันที่ </Text>
          <Text style={[styles.dottedLine, { minWidth: 20 }]}>
            {endDate.day}
          </Text>
          <Text style={styles.label}> เดือน </Text>
          <Text style={[styles.dottedLine, { minWidth: 55 }]}>
            {endDate.month}
          </Text>
          <Text style={styles.label}> พ.ศ. </Text>
          <Text style={[styles.dottedLine, { minWidth: 30 }]}>
            {endDate.year}
          </Text>
          <Text style={styles.label}> มีกำหนด </Text>
          <Text
            style={[styles.dottedLine, { minWidth: 30, fontWeight: "bold" }]}
          >
            {leaveDays}
          </Text>
          <Text style={styles.label}>
            {" "}
            ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่{" "}
          </Text>
          <Text style={[styles.dottedLine, { minWidth: 35 }]}> </Text>
        </View>

        {/* ...หมายเลขโทรศัพท์ */}
        <View style={[styles.row, { marginBottom: 1 }]}>
          <Text style={[styles.dottedLineLong]}> </Text>
          <Text style={styles.label}> หมายเลขโทรศัพท์ </Text>
          <Text style={[styles.dottedLine, { minWidth: 100 }]}> </Text>
        </View>

        {/* ลงชื่อผู้ลา */}
        <View style={styles.signSection}>
          <View style={styles.rowCenter}>
            <Text style={styles.label}>ลงชื่อ </Text>
            <Text style={[styles.dottedLine, { minWidth: 140 }]}> </Text>
          </View>
          <View style={[styles.rowCenter, { marginLeft: 20 }]}>
            <Text>( </Text>
            <Text style={[styles.dottedLine, { minWidth: 130 }]}>
              {leave.user.name}
            </Text>
            <Text> )</Text>
          </View>
        </View>

        {/* สถิติ + ความเห็น (2 คอลัมน์) */}
        <View style={styles.twoColumn}>
          {/* ฝั่งซ้าย - สถิติ */}
          <View style={styles.leftColumn}>
            <Text style={styles.sectionTitle}>สถิติการลาในปีงบประมาณนี้</Text>

            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={[styles.tableHeader, { width: "25%" }]}>
                  ประเภทลา
                </Text>
                <Text style={[styles.tableHeader, { width: "25%" }]}>
                  ลามาแล้ว{"\n"}ครั้ง/วัน
                </Text>
                <Text style={[styles.tableHeader, { width: "25%" }]}>
                  ลาครั้งนี้{"\n"}ครั้ง/วัน
                </Text>
                <Text style={[styles.tableHeader, { width: "25%" }]}>
                  รวมเป็น{"\n"}ครั้ง/วัน
                </Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>ป่วย</Text>
                <Text style={styles.tableCell}>
                  {leave.type === "SICK"
                    ? `${stats.pastCount}/${stats.pastDays}`
                    : ""}
                </Text>
                <Text style={styles.tableCell}>
                  {leave.type === "SICK"
                    ? `${stats.currentCount}/${stats.currentDays}`
                    : ""}
                </Text>
                <Text style={styles.tableCell}>
                  {leave.type === "SICK"
                    ? `${stats.totalCount}/${stats.totalDays}`
                    : ""}
                </Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>กิจ</Text>
                <Text style={styles.tableCell}>
                  {leave.type === "PERSONAL"
                    ? `${stats.pastCount}/${stats.pastDays}`
                    : ""}
                </Text>
                <Text style={styles.tableCell}>
                  {leave.type === "PERSONAL"
                    ? `${stats.currentCount}/${stats.currentDays}`
                    : ""}
                </Text>
                <Text style={styles.tableCell}>
                  {leave.type === "PERSONAL"
                    ? `${stats.totalCount}/${stats.totalDays}`
                    : ""}
                </Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>คลอดบุตร</Text>
                <Text style={styles.tableCell}>
                  {leave.type === "MATERNITY"
                    ? `${stats.pastCount}/${stats.pastDays}`
                    : ""}
                </Text>
                <Text style={styles.tableCell}>
                  {leave.type === "MATERNITY"
                    ? `${stats.currentCount}/${stats.currentDays}`
                    : ""}
                </Text>
                <Text style={styles.tableCell}>
                  {leave.type === "MATERNITY"
                    ? `${stats.totalCount}/${stats.totalDays}`
                    : ""}
                </Text>
              </View>
            </View>

            {/* ลงชื่อผู้ตรวจสอบ */}
            <View style={{ marginTop: 12 }}>
              <View style={styles.rowCenter}>
                <Text style={styles.label}>ลงชื่อ </Text>
                <Text style={[styles.dottedLine, { minWidth: 130 }]}> </Text>
                <Text style={styles.label}> ผู้ตรวจสอบ</Text>
              </View>
              <View style={[styles.rowCenter, { paddingLeft: 20 }]}>
                <Text>( </Text>
                <Text style={[styles.dottedLine, { minWidth: 130 }]}> </Text>
                <Text> )</Text>
              </View>
              <View style={[styles.rowCenter, { marginBottom: 8 }]}>
                <Text style={styles.label}>ตำแหน่ง </Text>
                <Text style={[styles.dottedLine, { minWidth: 145 }]}> </Text>
              </View>
              <View style={styles.rowCenter}>
                <Text style={styles.label}>วันที่ </Text>
                <Text style={[styles.dottedLine, { minWidth: 20 }]}> </Text>
                <Text> / </Text>
                <Text style={[styles.dottedLine, { minWidth: 30 }]}> </Text>
                <Text> / </Text>
                <Text style={[styles.dottedLine, { minWidth: 40 }]}> </Text>
              </View>
            </View>
          </View>

          {/* ฝั่งขวา - ความเห็น + คำสั่ง */}
          <View style={styles.rightColumn}>
            {/* ความเห็นของผู้บังคับบัญชา */}
            <Text style={styles.sectionTitleLeft}>
              ความเห็นของผู้บังคับบัญชา
            </Text>

            {/* เส้นความเห็น */}
            <View style={styles.fullLine} />
            <View style={styles.fullLine} />

            {/* ลงชื่อ */}
            <View style={[styles.leftAlignRow, { justifyContent: "center" }]}>
              <Text>ลงชื่อ </Text>
              <Text style={[styles.dottedLine, { minWidth: 155 }]} />
            </View>

            <View style={[styles.leftAlignRow, { justifyContent: "center" }]}>
              <Text>( </Text>
              <Text style={[styles.dottedLine, { minWidth: 155 }]} />
              <Text> )</Text>
            </View>

            <View
              style={[
                styles.leftAlignRow,
                { justifyContent: "center", marginBottom: 5 },
              ]}
            >
              <Text>ตำแหน่ง </Text>
              <Text style={[styles.dottedLine, { minWidth: 155 }]} />
            </View>

            <View
              style={[
                styles.leftAlignRow,
                { justifyContent: "center", marginBottom: 12 },
              ]}
            >
              <Text>วันที่ </Text>
              <Text style={[styles.dottedLine, { minWidth: 20 }]} />
              <Text> / </Text>
              <Text style={[styles.dottedLine, { minWidth: 30 }]} />
              <Text> / </Text>
              <Text style={[styles.dottedLine, { minWidth: 40 }]} />
            </View>

            {/* คำสั่ง */}
            <Text style={styles.sectionTitleLeft}>คำสั่ง</Text>

            {/* อนุญาต / ไม่อนุญาต */}
            <View style={[styles.leftAlignRow, { gap: 20, marginBottom: 5 }]}>
              <View style={styles.checkboxRow}>
                <View style={styles.circle} />
                <Text>อนุญาต</Text>
              </View>
              <View style={styles.checkboxRow}>
                <View style={styles.circle} />
                <Text>ไม่อนุญาต</Text>
              </View>
            </View>

            {/* ลงชื่อ */}
            <View style={[styles.leftAlignRow, { justifyContent: "center" }]}>
              <Text>ลงชื่อ </Text>
              <Text style={[styles.dottedLine, { minWidth: 155 }]} />
            </View>

            <View style={[styles.leftAlignRow, { justifyContent: "center" }]}>
              <Text>( </Text>
              <Text style={[styles.dottedLine, { minWidth: 155 }]} />
              <Text> )</Text>
            </View>

            <View style={[styles.leftAlignRow, { justifyContent: "center" }]}>
              <Text>ตำแหน่ง </Text>
              <Text style={[styles.dottedLine, { minWidth: 155 }]} />
            </View>

            {/* เส้นเพิ่มใต้ตำแหน่ง */}
            <View style={{ marginBottom: 5 }}>
              <Text style={[styles.dottedLine, { width: "100%" }]} />
            </View>

            <View style={[styles.leftAlignRow, { justifyContent: "center" }]}>
              <Text>วันที่ </Text>
              <Text style={[styles.dottedLine, { minWidth: 20 }]} />
              <Text> / </Text>
              <Text style={[styles.dottedLine, { minWidth: 30 }]} />
              <Text> / </Text>
              <Text style={[styles.dottedLine, { minWidth: 40 }]} />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ฟังก์ชันสร้าง PDF Blob
export async function generateLeavePDF(
  leave: Leave & { user: User },
  userStats?: LeaveFormPDFProps["userStats"],
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("generateLeavePDF can only be called on the client side");
  }
  const { pdf } = await import("@react-pdf/renderer");
  const blob = await pdf(
    <LeaveDocument leave={leave} userStats={userStats} />,
  ).toBlob();
  return blob;
}

// Component สำหรับดาวน์โหลด PDF
export function LeavePDFDownloadLink({
  leave,
  userStats,
  children,
}: LeaveFormPDFProps & { children: React.ReactNode }) {
  return (
    <PDFDownloadLink
      document={<LeaveDocument leave={leave} userStats={userStats} />}
      fileName={`leave_form_${leave.user.username}_${new Date().toISOString().split("T")[0]}.pdf`}
      style={{ textDecoration: "none" }}
    >
      {children}
    </PDFDownloadLink>
  );
}

export { LeaveDocument };
