import AdminTabs from "@/components/AdminTabs";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <AdminTabs />
      {children}
    </main>
  );
}
