#!/bin/sh
# ==================================================
# ตัด log ของ ems-reminder-worker ไม่ให้ไฟล์บวมไม่รู้จบ
# ==================================================
# ตั้งเป็น Synology Task Scheduler รายสัปดาห์:
#   DSM > Control Panel > Task Scheduler > Create > Scheduled Task > User-defined script
#   Schedule: รายสัปดาห์ (weekly)
#   Run command: sh /volume1/web/ems-admin/systemd/rotate-worker-log.sh
#
# เก็บ log 10000 บรรทัดล่าสุด ตัดของเก่าทิ้ง

LOG=/volume1/web/ems-admin/logs/worker.log

[ -f "$LOG" ] || exit 0

tail -n 10000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
