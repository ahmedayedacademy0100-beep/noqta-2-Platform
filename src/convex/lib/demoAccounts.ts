import type { Role } from "../schema";

/**
 * Demo sandbox accounts.
 *
 * These exist so the whole flow (teacher builds a quiz → student takes it →
 * sees a score) can be exercised without waiting for an email code. They are
 * flagged `isDemo` in the database, the UI labels them, and an administrator
 * can switch them off from Settings (which hides the one-click sign-in).
 */
export const DEMO_PASSWORD = "Demo1234!";

export type DemoAccountSpec = {
  key: string;
  role: Role;
  email: string;
  name: string;
  nameAr: string;
  password: string;
};

export const DEMO_ACCOUNTS: DemoAccountSpec[] = [
  {
    key: "admin",
    role: "super_admin",
    email: "admin@demo.noor.school",
    name: "Noqta Admin",
    nameAr: "مسؤول نُقطة",
    password: DEMO_PASSWORD,
  },
  {
    key: "teacherMath",
    role: "teacher",
    email: "sara@demo.noor.school",
    name: "Sara Haddad",
    nameAr: "سارة حداد",
    password: DEMO_PASSWORD,
  },
  {
    key: "teacherScience",
    role: "teacher",
    email: "omar@demo.noor.school",
    name: "Omar Nasser",
    nameAr: "عمر ناصر",
    password: DEMO_PASSWORD,
  },
  {
    key: "student1",
    role: "student",
    email: "lina@demo.noor.school",
    name: "Lina Khoury",
    nameAr: "لينا خوري",
    password: DEMO_PASSWORD,
  },
  {
    key: "student2",
    role: "student",
    email: "youssef@demo.noor.school",
    name: "Youssef Ali",
    nameAr: "يوسف علي",
    password: DEMO_PASSWORD,
  },
  {
    key: "student3",
    role: "student",
    email: "maryam@demo.noor.school",
    name: "Maryam Saleh",
    nameAr: "مريم صالح",
    password: DEMO_PASSWORD,
  },
  {
    key: "student4",
    role: "student",
    email: "ali@demo.noor.school",
    name: "Ali Rahal",
    nameAr: "علي رحال",
    password: DEMO_PASSWORD,
  },
];
