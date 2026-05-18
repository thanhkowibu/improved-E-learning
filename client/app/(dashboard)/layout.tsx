export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar will be added here later */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
