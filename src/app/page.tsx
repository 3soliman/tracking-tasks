import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container hero">
      <div className="grid-2" style={{ alignItems: "center" }}>
        <div>
          <h1 className="hero-title">نظام متابعة المهام</h1>
          <p className="hero-subtitle">
            المدير ينشئ المهمة ويشارك الرابط. أي شخص يفتح الرابط يُسجَّل تلقائياً عبر الكوكيز — بدون
            تسجيل حساب أو إعدادات تقنية.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/manager/login">
              دخول المدير
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>كيف يعمل؟</h2>
          <ol style={{ lineHeight: 1.9, paddingRight: 20 }}>
            <li>المدير ينشئ مهمة ويحدد الصفحة والمدة</li>
            <li>يحصل على رابط مشاركة واحد</li>
            <li>أي شخص يفتح الرابط يُعرَف تلقائياً (كوكيز)</li>
            <li>يُتابَع الوقت والتفاعل على الموقع المطلوب</li>
            <li>المدير يرى تقريراً لكل زائر</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
