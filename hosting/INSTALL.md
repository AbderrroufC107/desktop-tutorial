# تثبيت NFC RS على استضافة cPanel

النسخة: PHP + MySQL. تحتاج **PHP 7.4 أو أحدث** (8.x مفضّل) و**MySQL 5.7+ أو MariaDB 10.3+**، وكلاهما موجود في أغلب استضافات cPanel.

محتوى الملف المضغوط:

```
public_html/      ← ملفات الموقع (ترفع كما هي)
  api/            ← الخادم (PHP)
database.sql      ← جداول قاعدة البيانات
INSTALL.md        ← هذا الدليل
```

---

## 1. أنشئ قاعدة البيانات
1. cPanel ← **MySQL® Databases** (قواعد بيانات MySQL).
2. **Create New Database**: اكتب اسماً مثل `nfcrs` ← Create.
   (سيصبح الاسم الكامل مثل `cpaneluser_nfcrs` — احفظه.)
3. **MySQL Users ← Add New User**: اسم مستخدم + كلمة مرور قوية ← Create.
4. **Add User To Database**: اختر المستخدم والقاعدة ← Add ← حدّد **ALL PRIVILEGES** ← Make Changes.

## 2. استورد الجداول (اختياري)
> الموقع ينشئ الجداول تلقائياً عند أول استعمال. هذه الخطوة فقط إن أردت إنشاءها يدوياً.

1. cPanel ← **phpMyAdmin**.
2. اختر قاعدتك من اليسار ← تبويب **Import** (استيراد).
3. اختر ملف `database.sql` ← **Import** (تنفيذ).
4. يجب أن تظهر 5 جداول: `users`, `profiles`, `cards`, `password_resets`, `rate_limits`.

## 3. ارفع الملفات
1. cPanel ← **File Manager** ← افتح `public_html`.
2. ارفع **محتوى** مجلد `public_html` من الملف المضغوط (وليس المجلد نفسه).
   - الأسهل: ارفع الملف المضغوط كاملاً إلى `public_html` ← كليك يمين ← **Extract** ← ثم انقل محتوى `public_html` الناتج إلى `public_html` الرئيسي.
3. فعّل عرض الملفات المخفية (Settings ← Show Hidden Files) وتأكد أن ملف `.htaccess` موجود.

## 4. اربط الموقع بقاعدة البيانات
1. في File Manager افتح `public_html/api/`.
2. انسخ `config.sample.php` باسم **`config.php`** (كليك يمين ← Copy).
3. افتح `config.php` (Edit) وغيّر:
   ```php
   'db_name' => 'cpaneluser_nfcrs',     // اسم القاعدة الكامل
   'db_user' => 'cpaneluser_nfcrs',     // اسم المستخدم الكامل
   'db_pass' => 'كلمة المرور',
   'admin_emails' => ['بريدك@gmail.com'],   // بريدك أنت: يصبح حسابك مديراً
   'mail_from' => 'no-reply@نطاقك.com',   // لرسائل استرجاع كلمة المرور
   ```
4. احفظ.

## 5. جرّب
1. افتح `https://نطاقك.com/` ← تظهر الصفحة الرئيسية.
2. افتح `https://نطاقك.com/login.html` ← أنشئ حساباً **بنفس البريد** الذي وضعته في `admin_emails`.
3. افتح `https://نطاقك.com/admin.html` ← تظهر لوحة الإدارة ✅

## 6. (مستحسن) شهادة SSL
cPanel ← **SSL/TLS Status** ← Run AutoSSL. بعدها افتح `public_html/.htaccess` واحذف علامة `#` من آخر 3 أسطر لتحويل الزوار تلقائياً إلى https.

---

## (اختياري) تسجيل الدخول بجوجل
بدون هذه الخطوة يعمل الموقع بالبريد وكلمة المرور فقط، ولا يظهر زر جوجل.
1. https://console.cloud.google.com ← أنشئ مشروعاً.
2. **APIs & Services ← OAuth consent screen**: External ← املأ الاسم والبريد ← Publish.
3. **Credentials ← Create Credentials ← OAuth client ID** ← النوع **Web application**.
4. في **Authorized JavaScript origins** أضف: `https://نطاقك.com`
5. انسخ **Client ID** وضعه في `config.php`:
   ```php
   'google_client_id' => 'xxxxxxxx.apps.googleusercontent.com',
   ```

## روابطك
| الصفحة | الرابط |
|---|---|
| الرئيسية | `https://نطاقك.com/` |
| لوحة الزبون | `https://نطاقك.com/app.html` |
| لوحة الإدارة | `https://نطاقك.com/admin.html` |
| رابط البطاقة | `https://نطاقك.com/?c=الرمز` |

## نسخ احتياطي
cPanel ← phpMyAdmin ← قاعدتك ← **Export** ← Go. احفظ الملف أسبوعياً.

## مشاكل شائعة
| المشكلة | الحل |
|---|---|
| "تعذر الاتصال بقاعدة البيانات" | تحقق من الاسم الكامل للقاعدة والمستخدم وكلمة المرور في `config.php` |
| "الموقع غير مُعدّ بعد" | لم يُنسخ `config.sample.php` إلى `config.php` |
| لا تصل رسالة استرجاع كلمة المرور | ضع في `mail_from` بريداً من نطاقك، وأنشئه في cPanel ← Email Accounts |
| لوحة الإدارة مقفلة | البريد في `admin_emails` يجب أن يطابق بريد حسابك تماماً |
