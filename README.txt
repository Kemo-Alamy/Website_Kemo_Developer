KEMO DEVELOPER — ملفات الموقع

الملفات:
- index.html
- styles.css
- app.js
- firebase-config.js

طريقة الرفع:
1) فك ضغط الملف.
2) ارفع الملفات الأربعة إلى نفس المجلد في مستودع GitHub Pages.
3) تأكد أن أسماء الملفات بالحروف الصغيرة كما هي.
4) لا ترفع مجلد KEMO_DEVELOPER_NEW نفسه؛ ارفع الملفات التي بداخله إلى جذر المستودع أو نفس مكان index.html الحالي.

ملاحظات Firebase:
- يستخدم الموقع Firebase Authentication وCloud Firestore.
- يجب تفعيل Email/Password من Firebase Authentication.
- يجب أن يوجد مستند admins/UID الخاص بالأدمن وفيه role = "admin".
- يعتمد الموقع على مجموعة apps في Firestore.
- إضافة التطبيق تحتاج رابط تحميل خارجي مباشر صالح (HTTPS/HTTP)، ورابط صورة اختياري. لا يحتاج هذا الإصدار إلى Firebase Storage.
- تأكد أن قواعد Firestore تسمح بقراءة apps للجميع وبالكتابة للأدمن فقط، وأن المستخدم يستطيع قراءة مستند admin الخاص به.

تنبيه:
روابط التحميل والصور تُدخل من لوحة الأدمن. استخدم روابط موثوقة وقانونية فقط.
