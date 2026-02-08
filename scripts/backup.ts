/**
 * ==================================================
 * Database Backup Utility - เครื่องมือสำรองข้อมูลฐานข้อมูล
 * ==================================================
 * ใช้สำหรับสร้าง backup ของฐานข้อมูล MariaDB
 * รองรับทั้ง manual backup และ scheduled backup
 * 
 * การใช้งาน:
 * npx tsx scripts/backup.ts
 * หรือ
 * npm run db:backup
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../src/lib/logger';

const execAsync = promisify(exec);

// Configuration
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_NAME = process.env.DB_NAME || 'ems_db';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);

/**
 * ตรวจสอบและสร้าง backup directory
 */
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info('Created backup directory', { path: BACKUP_DIR });
  }
}

/**
 * สร้างชื่อไฟล์ backup
 */
function generateBackupFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${DB_NAME}_backup_${timestamp}.sql`;
}

/**
 * สร้าง database backup
 */
export async function createBackup(): Promise<{ success: boolean; filename?: string; error?: string }> {
  ensureBackupDir();
  
  const filename = generateBackupFilename();
  const filepath = path.join(BACKUP_DIR, filename);
  
  try {
    // Build mysqldump command
    const cmd = `mysqldump -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} ${DB_PASSWORD ? `-p${DB_PASSWORD}` : ''} --single-transaction --routines --triggers ${DB_NAME} > "${filepath}"`;
    
    logger.info('Starting database backup', { filename, database: DB_NAME });
    
    await execAsync(cmd);
    
    // Compress backup file
    const compressedFilepath = `${filepath}.gz`;
    await execAsync(`gzip -c "${filepath}" > "${compressedFilepath}"`);
    
    // Remove uncompressed file
    fs.unlinkSync(filepath);
    
    const stats = fs.statSync(compressedFilepath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    logger.info('Backup completed successfully', {
      filename: `${filename}.gz`,
      sizeMB,
      path: compressedFilepath,
    });
    
    return { success: true, filename: `${filename}.gz` };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Backup failed', { error: errorMessage, filename });
    
    // Cleanup failed backup file if exists
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    
    return { success: false, error: errorMessage };
  }
}

/**
 * ลบ backup files เก่าเกิน retention period
 */
export function cleanupOldBackups(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    return;
  }
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  
  const files = fs.readdirSync(BACKUP_DIR);
  let deletedCount = 0;
  
  for (const file of files) {
    const filepath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filepath);
    
    if (stats.mtime < cutoffDate) {
      fs.unlinkSync(filepath);
      deletedCount++;
      logger.info('Deleted old backup file', { file, createdAt: stats.mtime });
    }
  }
  
  if (deletedCount > 0) {
    logger.info('Cleanup completed', { deletedCount, retentionDays: RETENTION_DAYS });
  }
}

/**
 * ดึงรายการ backup files
 */
export function listBackups(): Array<{ filename: string; size: number; createdAt: Date }> {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(BACKUP_DIR);
  const backups: Array<{ filename: string; size: number; createdAt: Date }> = [];
  
  for (const file of files) {
    const filepath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filepath);
    
    backups.push({
      filename: file,
      size: stats.size,
      createdAt: stats.mtime,
    });
  }
  
  // Sort by createdAt desc
  return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * กู้คืนฐานข้อมูลจาก backup
 */
export async function restoreBackup(filename: string): Promise<{ success: boolean; error?: string }> {
  const filepath = path.join(BACKUP_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    return { success: false, error: `Backup file not found: ${filename}` };
  }
  
  try {
    let sqlFile = filepath;
    
    // Decompress if .gz file
    if (filepath.endsWith('.gz')) {
      sqlFile = filepath.replace('.gz', '');
      await execAsync(`gunzip -c "${filepath}" > "${sqlFile}"`);
    }
    
    logger.info('Starting database restore', { filename });
    
    // Restore database
    const cmd = `mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} ${DB_PASSWORD ? `-p${DB_PASSWORD}` : ''} ${DB_NAME} < "${sqlFile}"`;
    await execAsync(cmd);
    
    // Cleanup decompressed file
    if (sqlFile !== filepath && fs.existsSync(sqlFile)) {
      fs.unlinkSync(sqlFile);
    }
    
    logger.info('Database restore completed', { filename });
    
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Restore failed', { error: errorMessage, filename });
    return { success: false, error: errorMessage };
  }
}

/**
 * ฟังก์ชันหลักสำหรับรัน backup
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'restore':
      if (!args[1]) {
        console.error('Usage: npm run db:backup restore <filename>');
        process.exit(1);
      }
      const restoreResult = await restoreBackup(args[1]);
      if (!restoreResult.success) {
        console.error('❌ Restore failed:', restoreResult.error);
        process.exit(1);
      }
      console.log('✅ Restore completed successfully');
      break;
      
    case 'list':
      const backups = listBackups();
      if (backups.length === 0) {
        console.log('No backups found');
      } else {
        console.log('Available backups:');
        backups.forEach(b => {
          const sizeMB = (b.size / 1024 / 1024).toFixed(2);
          console.log(`  - ${b.filename} (${sizeMB} MB) - ${b.createdAt.toISOString()}`);
        });
      }
      break;
      
    default:
      // Default: create backup
      console.log('🔄 Starting database backup...');
      const result = await createBackup();
      
      if (!result.success) {
        console.error('❌ Backup failed:', result.error);
        process.exit(1);
      }
      
      console.log(`✅ Backup completed: ${result.filename}`);
      
      // Cleanup old backups
      cleanupOldBackups();
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { main };
