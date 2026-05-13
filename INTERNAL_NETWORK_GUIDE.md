# دليل تشغيل برنامج التفتيش على الشبكة الداخلية

هذا الدليل يوضح طريقة تشغيل نظام تفتيش خدمات البيئة / التدبير المنزلي على الشبكة الداخلية بحيث يمكن فتحه من أجهزة أخرى مثل الكمبيوتر أو الآيباد داخل نفس الشبكة.

## 1. مسار المشروع

المشروع موجود في المسار التالي:

```text
C:\.....\.....\....\.....\2026-05-12\files-mentioned-by-the-user-audit
```

## 2. معرفة عنوان IP للجهاز المشغل

على الجهاز الذي سيشغل البرنامج، افتح PowerShell واكتب:

```powershell
ipconfig
```

ابحث عن قيمة:

```text
IPv4 Address
```

مثال:

```text
172.20.10.2
```

هذا العنوان يستخدم للدخول على البرنامج من الأجهزة الأخرى.

## 3. تشغيل الباكند

افتح PowerShell داخل مجلد المشروع:

```powershell
cd C:\....\....\.....\.....\2026-05-12\files-mentioned-by-the-user-audit
npm run dev --prefix server
```

الباكند يعمل على:

```text
http://localhost:4000
```

## 4. تشغيل الواجهة

افتح PowerShell ثاني داخل مجلد المشروع:

```powershell
cd C:\.....\....\.....\.....\2026-05-12\files-mentioned-by-the-user-audit
npm run dev --prefix client
```

الواجهة تعمل على الجهاز نفسه:

```text
http://localhost:5173
```

ومن الأجهزة الأخرى داخل نفس الشبكة:

```text
http://YOUR-IP:5173
```

مثال:

```text
http://172.20.10.2:5173
```

## 5. السماح من جدار الحماية

إذا لم يفتح البرنامج من جهاز آخر، افتح PowerShell كمسؤول وشغل الأوامر التالية:

```powershell
netsh advfirewall firewall add rule name="EVS Frontend 5173" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="EVS Backend 4000" dir=in action=allow protocol=TCP localport=4000
```

## 6. الدخول للنظام من الشبكة

من أي جهاز على نفس الشبكة افتح المتصفح واكتب:

```text
http://172.20.10.2:5173
```

استبدل `172.20.10.2` بعنوان IP الخاص بالجهاز المشغل.

## 7. حسابات الدخول التجريبية

```text
Admin:
username: admin
password: admin123

Manager:
username: manager
password: manager123

Supervisor:
username: supervisor
password: super123

Inspector:
username: inspector
password: inspect123
```

## 8. أماكن حفظ الملفات

تقارير التفتيش:

```text
storage\reports\
```

التقارير الشهرية PDF و Excel:

```text
storage\monthly-reports\
```

التقارير الأسبوعية:

```text
storage\weekly-reports\
```

ملفات Excel العامة:

```text
storage\excel\
```

النسخ الاحتياطية اليومية:

```text
storage\backups\YYYY-MM-DD\
```

كل نسخة يومية تحتوي:

- `server-data`: بيانات المستخدمين، القوائم، النماذج، والتقارير المسجلة.
- `storage`: التقارير وملفات Excel.
- `manifest.json`: معلومات النسخة الاحتياطية.

وقت النسخ الافتراضي:

```text
02:00
```

يمكن تعديل وقت النسخ وعدد أيام الاحتفاظ من ملف:

```text
server\.env
```

باستخدام:

```env
BACKUP_TIME=02:00
BACKUP_RETENTION_DAYS=30
```

## 9. ملاحظات مهمة

- يجب أن يبقى الجهاز المشغل للبرنامج مفتوحا أثناء الاستخدام.
- لا تغلق نوافذ PowerShell الخاصة بالباكند والواجهة.
- يجب أن تكون الأجهزة الأخرى متصلة بنفس الشبكة الداخلية.
- إذا تغير عنوان IP للجهاز المشغل، استخدم العنوان الجديد في المتصفح.
- يفضل تثبيت عنوان IP للجهاز المشغل من إعدادات الشبكة إذا كان البرنامج سيستخدم بشكل دائم.
