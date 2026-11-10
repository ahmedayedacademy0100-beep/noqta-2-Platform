import { useI18n } from "@/i18n";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

/**
 * Public privacy policy.
 *
 * AdSense requires a reachable privacy policy that names Google's advertising
 * cookies, and the platform handles student data, so this page is linked from
 * the landing footer rather than buried in the app.
 */
type Section = { en: string; ar: string; bodyEn: string[]; bodyAr: string[] };

const SECTIONS: Section[] = [
  {
    en: "What we collect",
    ar: "ما الذي نجمعه",
    bodyEn: [
      "Account details the school provides or you create: name, email, role, class and language.",
      "Learning activity: answers, submissions, grades, homework, game results, XP and streaks.",
      "Technical data needed to keep the service safe: device type, browser, and connection information used for security and fraud prevention.",
    ],
    bodyAr: [
      "بيانات الحساب التي توفرها المدرسة أو تنشئها أنت: الاسم، البريد الإلكتروني، الدور، الصف، اللغة.",
      "النشاط التعليمي: الإجابات، التسليمات، الدرجات، الواجبات، نتائج الألعاب، نقاط الخبرة والسلاسل.",
      "بيانات تقنية لازمة لحماية الخدمة: نوع الجهاز، المتصفح، ومعلومات الاتصال المستخدمة للأمان ومنع إساءة الاستخدام.",
    ],
  },
  {
    en: "How we use it",
    ar: "كيف نستخدمها",
    bodyEn: [
      "To run assessments, homework, results and learning games, and to show progress to you and your teachers.",
      "To keep accounts secure, detect abuse, and improve the reliability of the platform.",
      "We never sell personal data, and we do not use student answers for advertising.",
    ],
    bodyAr: [
      "لتشغيل الاختبارات والواجبات والنتائج والألعاب التعليمية، وعرض التقدم لك وللمعلمين.",
      "لحماية الحسابات، وكشف إساءة الاستخدام، وتحسين موثوقية المنصة.",
      "لا نبيع البيانات الشخصية، ولا نستخدم إجابات الطلاب لأغراض إعلانية.",
    ],
  },
  {
    en: "Cookies and advertising",
    ar: "ملفات تعريف الارتباط والإعلانات",
    bodyEn: [
      "The platform uses cookies and local storage to keep you signed in and to remember your language and theme.",
      "Google AdSense may show ads on public pages and inside the portal. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this and other websites.",
      "Google's use of advertising cookies lets it and its partners serve ads based on your visits. You can opt out of personalised advertising in Google Ads Settings (google.com/settings/ads).",
      "Advertisements are never shown inside a live assessment, and super-admin accounts never see ads.",
    ],
    bodyAr: [
      "تستخدم المنصة ملفات تعريف الارتباط والتخزين المحلي لإبقائك مسجّل الدخول وتذكّر لغتك ومظهرك.",
      "قد تعرض Google AdSense إعلانات في الصفحات العامة وداخل البوابة. ويستخدم مورّدون خارجيون، ومنهم Google، ملفات تعريف الارتباط لعرض إعلانات بناءً على زياراتك السابقة لهذا الموقع ومواقع أخرى.",
      "يتيح استخدام Google لملفات تعريف الارتباط الإعلانية لها ولشركائها عرض إعلانات بناءً على زياراتك. يمكنك إيقاف الإعلانات المخصّصة من إعدادات إعلانات Google (google.com/settings/ads).",
      "لا تظهر الإعلانات أبدًا داخل اختبار جارٍ، ولا تظهر لحساب مدير المنصة.",
    ],
  },
  {
    en: "Students and guardians",
    ar: "الطلاب وأولياء الأمور",
    bodyEn: [
      "Student accounts are created by the school. For students under 13, the school confirms that a guardian has consented before the account is used.",
      "Teachers see the students in their own classes only; administrators see the school they manage.",
    ],
    bodyAr: [
      "تُنشئ المدرسة حسابات الطلاب. وللطلاب دون ١٣ عامًا، تؤكد المدرسة موافقة ولي الأمر قبل استخدام الحساب.",
      "يرى المعلم طلاب صفوفه فقط، ويرى مدير المنصة المدرسة التي يديرها.",
    ],
  },
  {
    en: "Retention and your rights",
    ar: "الاحتفاظ بالبيانات وحقوقك",
    bodyEn: [
      "Records are kept while the account is active and for the period the school needs for academic records.",
      "You can ask to access, correct or delete your data by contacting your school administrator. Deletion removes the account and its learning records, except where the school must keep results.",
    ],
    bodyAr: [
      "تُحفظ السجلات ما دام الحساب نشطًا وللمدة التي تحتاجها المدرسة للسجلات الأكاديمية.",
      "يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها بالتواصل مع مدير المدرسة. ويؤدي الحذف إلى إزالة الحساب وسجلاته التعليمية، إلا ما يلزم على المدرسة الاحتفاظ به من نتائج.",
    ],
  },
];

export default function Privacy() {
  const { pick } = useI18n();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {pick("Back to home", "العودة إلى الرئيسية")}
      </Link>
      <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">
        {pick("Privacy policy", "سياسة الخصوصية")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {pick("Last updated: November 2026", "آخر تحديث: نوفمبر ٢٠٢٦")}
      </p>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        {pick(
          "Noqta runs assessments, homework and learning games for students. This page explains what we store, why, and the choices you have. It also covers the cookies used by Google AdSense, which serves the ads on this site.",
          "تشغّل نُقطة الاختبارات والواجبات والألعاب التعليمية للطلاب. توضح هذه الصفحة ما نحفظه ولماذا، والخيارات المتاحة لك، وتشرح أيضًا ملفات تعريف الارتباط التي تستخدمها Google AdSense لعرض الإعلانات على هذا الموقع.",
        )}
      </p>

      <div className="mt-10 space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.en}>
            <h2 className="text-lg font-extrabold">{pick(section.en, section.ar)}</h2>
            <ul className="mt-3 space-y-2">
              {section.bodyEn.map((line, index) => (
                <li
                  key={line}
                  className="flex gap-2 text-sm leading-7 text-muted-foreground"
                >
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{pick(line, section.bodyAr[index] ?? line)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm leading-7 text-muted-foreground">
        {pick(
          "Questions about this policy or your data? Contact your school administrator from the account menu and they will reach the platform team.",
          "لديك سؤال عن هذه السياسة أو عن بياناتك؟ تواصل مع مدير مدرستك من قائمة الحساب وسيصل طلبك إلى فريق المنصة.",
        )}
      </p>
    </div>
  );
}
