/**
 * ==================================================
 * Prisma Seed - ข้อมูลเริ่มต้นสำหรับระบบ
 * ==================================================
 * ไฟล์นี้ใช้สำหรับสร้างข้อมูลเริ่มต้นในระบบ
 * รวมถึงผู้ใช้ admin และข้อมูลตัวอย่าง
 *
 * การใช้งาน:
 * npx prisma db seed
 * หรือ
 * npm run db:seed
 */

import { PrismaClient, Role, Priority, LeaveType, LeaveStatus } from '@prisma/client';
import { hashPassword } from '../src/lib/security';

const prisma = new PrismaClient();

// helper: แปลงวันเกิดจาก พ.ศ. เป็น Date object (ค.ศ.)
function bdTH(day: number, month: number, buddhistYear: number): Date {
  return new Date(buddhistYear - 543, month - 1, day);
}

/**
 * ฟังก์หลักสำหรับ seed ข้อมูล
 */
async function main() {
  console.log('🌱 เริ่มต้น seed ข้อมูล...');

  // ============================================
  // สร้างผู้ใช้ Admin (ลำดับที่ 6 - มาร์ช)
  // ============================================
  console.log('👤 กำลังสร้างผู้ใช้ Admin...');

  const adminPassword = await hashPassword('TRD02.trd02');

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      email: 'chawut.sa@gmail.com',
      prefix: 'นาย',
      name: 'ชาวุฒิ สงวนศักดิ์',
      phone: '084-4928647',
      birthday: bdTH(23, 2, 2531),
      role: Role.SUPER_ADMIN,
      department: 'กองการศึกษา วิจัย และพัฒนา',
      division: 'ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง',
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 3',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 3,
    },
    create: {
      email: 'chawut.sa@gmail.com',
      username: 'admin',
      password: adminPassword,
      prefix: 'นาย',
      name: 'ชาวุฒิ สงวนศักดิ์',
      phone: '084-4928647',
      birthday: bdTH(23, 2, 2531),
      role: Role.SUPER_ADMIN,
      department: 'กองการศึกษา วิจัย และพัฒนา',
      division: 'ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง',
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 3',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 3,
      avatar: 'CS',
      isActive: true,
    },
  });

  console.log('✅ สร้างผู้ใช้ Admin สำเร็จ:', admin.username);

  // ============================================
  // สร้างผู้ใช้ทั้งหมดจากรายชื่อ
  // ============================================
  console.log('👥 กำลังสร้างผู้ใช้...');

  const userPassword = await hashPassword('trd-dtc.123');

  const allUsers = [
    // ลำดับที่ 1 - พ.อ.ปรียพงศ์ (ปอ) - ผู้อำนวยการกอง
    {
      username: 'ppong',
      email: 'preeyapong.samipagdi@gmail.com',
      prefix: 'พ.อ.',
      name: 'ปรียพงศ์ สามิภักดิ์',
      phone: '081-9092616',
      birthday: bdTH(27, 5, 2519),
      role: Role.MANAGER,
      position: 'ผู้อำนวยการกอง',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: null,
      avatar: 'PP',
    },
    // ลำดับที่ 2 - นางสาวอรทัย (จิ๋ว) - รองหัวหน้าฝ่าย ระดับ 6
    {
      username: 'oratiy',
      email: 'ora1975@gmail.com',
      prefix: 'นางสาว',
      name: 'อรทัย ติยศิวาพร',
      phone: '095-7279649',
      birthday: bdTH(13, 2, 2518),
      role: Role.MANAGER,
      position: 'รองหัวหน้าฝ่าย ระดับ 6',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 6,
      avatar: 'OT',
    },
    // ลำดับที่ 3 - ร.ท.ชยาวิชญ์ (อาร์ม) - เจ้าหน้าที่ฯ ระดับ 5
    {
      username: 'chayawit',
      email: 'chyanantormor@gmail.com',
      prefix: 'ร.ท.',
      name: 'ชยาวิชญ์ ลีลา',
      phone: '080-571-5203',
      birthday: bdTH(6, 8, 2538),
      role: Role.MANAGER,
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 5',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 5,
      avatar: 'CL',
    },
    // ลำดับที่ 4 - ร.ท.โกเศศ (ยิน) - เจ้าหน้าที่ฯ ระดับ 4
    {
      username: 'mrko',
      email: '',
      prefix: 'ร.ท.',
      name: 'โกเศศ ศรีอุทธา',
      phone: '092-6814550',
      birthday: bdTH(10, 3, 2532),
      role: Role.EMPLOYEE,
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 4',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 4,
      avatar: 'KS',
    },
    // ลำดับที่ 5 - นายภูริณัฐ (ภูมิ) - เจ้าหน้าที่ฯ ระดับ 3
    {
      username: 'phurinut',
      email: 'phurinat1691@gmail.com',
      prefix: 'นาย',
      name: 'ภูริณัฐ ใหม่อ่อน',
      phone: '090-9260191',
      birthday: bdTH(2, 6, 2537),
      role: Role.EMPLOYEE,
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 3',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 3,
      avatar: 'PM',
    },
    // ลำดับที่ 7 - นายณรงฤทธิ์ (บาส) - เจ้าหน้าที่ฯ ระดับ 3
    {
      username: 'narongrit',
      email: 'bastrd.dtc@gmail.com',
      prefix: 'นาย',
      name: 'ณรงฤทธิ์ ศรีนวล',
      phone: '095-7737779',
      birthday: bdTH(25, 12, 2534),
      role: Role.EMPLOYEE,
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 3',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 3,
      avatar: 'NS',
    },
    // ลำดับที่ 8 - นางสาวมลสนา (ปอ) - เจ้าหน้าที่ฯ ระดับ 3
    {
      username: 'molsana',
      email: 'a_por15@hotmail.com',
      prefix: 'นางสาว',
      name: 'มลสนา นามหงสา',
      phone: '097-1426946',
      birthday: bdTH(31, 8, 2530),
      role: Role.EMPLOYEE,
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 3',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 3,
      avatar: 'MN',
    },
    // ลำดับที่ 9 - นางสาวสุวิภาพร (แอม) - เจ้าหน้าที่ฯ ระดับ 3
    {
      username: 'admin3',
      email: 'suwipaporn.1992@gmail.com',
      prefix: 'นางสาว',
      name: 'สุวิภาพร ศรีเนตร',
      phone: '080-5629787',
      birthday: bdTH(21, 11, 2535),
      role: Role.SUPER_ADMIN,
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 3',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 3,
      avatar: 'SS',
    },
    // ลำดับที่ 10 - นางสาววาริรัตน์ (อุ้ย) - เจ้าหน้าที่ฯ ระดับ 3
    {
      username: 'wareerut',
      email: 'assdkapore@gmail.com',
      prefix: 'นางสาว',
      name: 'วาริรัตน์ สุก้อน',
      phone: '089-8887351',
      birthday: bdTH(13, 2, 2523),
      role: Role.EMPLOYEE,
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 3',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 3,
      avatar: 'WS',
    },
    // ลำดับที่ 11 - นางสาวอชิรญา (อิ้ง) - เจ้าหน้าที่ฯ ระดับ 3
    {
      username: 'archiraya',
      email: 'atnannat@gmail.com',
      prefix: 'นางสาว',
      name: 'อชิรญา อนุตรวัฒนกุล',
      phone: '080-4897398',
      birthday: bdTH(28, 3, 2539),
      role: Role.EMPLOYEE,
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 3',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 3,
      avatar: 'AA',
    },
    // ลำดับที่ 12 - นางสาวขวัญทยา (ลิ้ง) - เจ้าหน้าที่ฯ ระดับ 3
    {
      username: 'kwan',
      email: 'kwanthayar@gmail.com',
      prefix: 'นางสาว',
      name: 'ขวัญทยา รวมทรัพย์',
      phone: '096-7548555',
      birthday: bdTH(27, 6, 2540),
      role: Role.EMPLOYEE,
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 3',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 3,
      avatar: 'KR',
    },
    // ลำดับที่ 13 - นายอัครวุฒิ (แบงค์) - เจ้าหน้าที่ฯ ระดับ 3
    {
      username: 'akrarawut',
      email: 'bankop2566@gmail.com',
      prefix: 'นาย',
      name: 'อัครวุฒิ งามวิถี',
      phone: '090-4171651',
      birthday: bdTH(13, 10, 2534),
      role: Role.EMPLOYEE,
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 3',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 3,
      avatar: 'AN',
    },
    // ลำดับที่ 14 - นางสาวพุทธิเนตร (มิน) - เจ้าหน้าที่ฯ ระดับ 3
    {
      username: 'phutdhinet',
      email: 'puttinate@gmail.com',
      prefix: 'นางสาว',
      name: 'พุทธิเนตร สุดดีพงศ์',
      phone: '085-9149021',
      birthday: bdTH(21, 5, 2531),
      role: Role.EMPLOYEE,
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 3',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 3,
      avatar: 'PS',
    },
    // ลำดับที่ 15 - นายรณฤทธิ์ (สมาย) - เจ้าหน้าที่ฯ ระดับ 3
    {
      username: 'ronnarit',
      email: 'smilebubfalo@gmail.com',
      prefix: 'นาย',
      name: 'รณฤทธิ์ พิลาไชย',
      phone: '082-5906445',
      birthday: bdTH(22, 2, 2539),
      role: Role.EMPLOYEE,
      position: 'เจ้าหน้าที่งานในพระองค์ ระดับ 3',
      positionSecond: 'เจ้าหน้าที่งานในพระองค์',
      positionLevel: 3,
      avatar: 'RP',
    },
    // ลำดับที่ 16 - นายเอกรินทร์ (โหนก) - ลูกจ้างท้ายที่นั่ง ระดับ 2
    {
      username: 'aekarin',
      email: 'Egkarin_tu@hotmail.com',
      prefix: 'นาย',
      name: 'เอกรินทร์ โพธิวัฒน์',
      phone: '095-8945808',
      birthday: bdTH(26, 3, 2531),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'AP',
    },
    // ลำดับที่ 17 - นางสาววราภรณ์ (ครีม) - ลูกจ้างท้ายที่นั่ง
    {
      username: 'waraporn',
      email: 'Waraporn253827068@gmail.com',
      prefix: 'นางสาว',
      name: 'วราภรณ์ คงเกตุ',
      phone: '061-8585269',
      birthday: bdTH(18, 8, 2538),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'WK',
    },
    // ลำดับที่ 18 - นางสาวปิยพร (น้ำ) - ลูกจ้างท้ายที่นั่ง
    {
      username: 'piyaporn',
      email: 'piyapornnontapa@gmail.com',
      prefix: 'นางสาว',
      name: 'ปิยพร นนทภา',
      phone: '092-6761335',
      birthday: bdTH(26, 5, 2537),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'PN',
    },
    // ลำดับที่ 19 - นางสาววาสิฏฐี (ออ) - ลูกจ้างท้ายที่นั่ง
    {
      username: 'wasittee',
      email: 'aor.wasittee@gmail.com',
      prefix: 'นางสาว',
      name: 'วาสิฏฐี มุสิกะพันธ์',
      phone: '084-9553816',
      birthday: bdTH(14, 10, 2531),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'WM',
    },
    // ลำดับที่ 20 - นายโยธิน (โย) - ลูกจ้างท้ายที่นั่ง
    {
      username: 'yothin',
      email: 'yothin.tangchanachaiphong@gmail.com',
      prefix: 'นาย',
      name: 'โยธิน ตั้งชนะชัยพงษ์',
      phone: '098-1509955',
      birthday: bdTH(3, 4, 2540),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'YT',
    },
    // ลำดับที่ 21 - นายฐิติกร (บาส) - ลูกจ้างท้ายที่นั่ง
    {
      username: 'thitikorn',
      email: 'thitikorn.jawangs@gmail.com',
      prefix: 'นาย',
      name: 'ฐิติกร จ่าวัง',
      phone: '098-2742946',
      birthday: bdTH(28, 5, 2540),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'TJ',
    },
    // ลำดับที่ 22 - พงศ์ศิริ (ดล) - ลูกจ้างท้ายที่นั่ง
    {
      username: 'pongsiri',
      email: 'pongsiri.kase@gmail.com',
      prefix: 'นาย',
      name: 'พงศ์ศิริ เกษตรสิน',
      phone: '062-3929193',
      birthday: bdTH(24, 6, 2535),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'PK',
    },
    // ลำดับที่ 23 - นางสาวจุฬารัชต์ (ลูกปัด) - ลูกจ้างท้ายที่นั่ง
    {
      username: 'jurarat',
      email: 'llukpadmak@gmail.com',
      prefix: 'นางสาว',
      name: 'จุฬารัชต์ มากเปรมบุญ',
      phone: '081-5322351',
      birthday: bdTH(30, 11, 2536),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'JM',
    },
    // ลำดับที่ 24 - นายฐากูร (โช) - ลูกจ้างท้ายที่นั่ง
    {
      username: 'thakoon',
      email: 'takoon2a@gmail.com',
      prefix: 'นาย',
      name: 'ฐากูร ตั้งชนะชัยพงษ์',
      phone: '095-4782631',
      birthday: bdTH(23, 7, 2546),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'TT',
    },
    // ลำดับที่ 25 - นายนิภัทร์ (โจ) - ลูกจ้างท้ายที่นั่ง
    {
      username: 'niphat',
      email: 'niphat.nj@gmail.com',
      prefix: 'นาย',
      name: 'นิภัทร์ ใจซื่อ',
      phone: '098-9124328',
      birthday: bdTH(7, 12, 2542),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'NJ',
    },
    // ลำดับที่ 26 - นางสาวฉัตรนภา (เนอส) - ลูกจ้างท้ายที่นั่ง
    {
      username: 'chatnapa',
      email: 'nurse.cnp@gmail.com',
      prefix: 'นางสาว',
      name: 'ฉัตรนภา ปันแสง',
      phone: '091-7787450',
      birthday: bdTH(2, 2, 2546),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'CP',
    },
    // ลำดับที่ 27 - นางสาวสิริรุ่ง (เอิน) - ลูกจ้างท้ายที่นั่ง
    {
      username: 'sirirung',
      email: 'Sirirungg2541@gmail.com',
      prefix: 'นางสาว',
      name: 'สิริรุ่ง กถาวิโรจน์',
      phone: '062-3584832',
      birthday: bdTH(25, 8, 2541),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'SK',
    },
    // ลำดับที่ 28 - นายอนุชิต (ต้า) - ลูกจ้างท้ายที่นั่ง
    {
      username: 'anuchit',
      email: 'Anuchit_tar42@hotmail.com',
      prefix: 'นาย',
      name: 'อนุชิต เจริญเขต',
      phone: '095-5105959',
      birthday: bdTH(13, 2, 2542),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'AJ',
    },
    // ลำดับที่ 29 - นางสาวหทัยภัทร (อุ้ม) - ลูกจ้างท้ายที่นั่ง
    {
      username: 'hathaiphat',
      email: 'hataipat.a@gmail.com',
      prefix: 'นางสาว',
      name: 'หทัยภัทร อังศุการ',
      phone: '098-8914441',
      birthday: bdTH(24, 9, 2543),
      role: Role.EMPLOYEE,
      position: 'ลูกจ้างท้ายที่นั่ง',
      positionSecond: 'ลูกจ้างท้ายที่นั่ง',
      positionLevel: null,
      avatar: 'HA',
    },
  ];

  for (const userData of allUsers) {
    const { email, birthday, positionLevel, phone, ...rest } = userData;
    const createData: any = {
      ...rest,
      password: userPassword,
      isActive: true,
      department: 'กองการศึกษา วิจัย และพัฒนา',
      division: 'ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง',
    };
    if (email) createData.email = email;
    else createData.email = `${rest.username}@ems.local`;
    if (birthday) createData.birthday = birthday;
    if (positionLevel !== null) createData.positionLevel = positionLevel;
    if (phone) createData.phone = phone;

    const updateData: any = { ...createData };
    delete updateData.password; // ไม่รีเซ็ต password เมื่อ update

    const user = await prisma.user.upsert({
      where: { username: userData.username },
      update: updateData,
      create: createData,
    });
    console.log('✅ บันทึกผู้ใช้:', user.name);
  }

  // ============================================
  // สร้างคอลัมน์ Kanban เริ่มต้น
  // ============================================
  console.log('📊 กำลังสร้างคอลัมน์ Kanban...');

  const defaultColumns = [
    { name: 'รอดำเนินการ', color: 'slate', order: 0, isDefault: true },
    { name: 'กำลังทำ', color: 'blue', order: 1, isDefault: true },
    { name: 'เสร็จสิ้น', color: 'emerald', order: 2, isDefault: true },
  ];

  for (const colData of defaultColumns) {
    const column = await prisma.kanbanColumn.upsert({
      where: { id: colData.order + 1 },
      update: {},
      create: colData,
    });
    console.log('✅ สร้างคอลัมน์:', column.name);
  }

  console.log('✨ Seed ข้อมูลเสร็จสมบูรณ์!');
  console.log('');
  console.log('🔑 ข้อมูลเข้าสู่ระบบ:');
  console.log('   Username: admin');
  console.log('   Password: TRD02.trd02');
}

/**
 * รัน seed และจัดการข้อผิดพลาด
 */
main()
  .catch((e) => {
    console.error('❌ เกิดข้อผิดพลาด:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
