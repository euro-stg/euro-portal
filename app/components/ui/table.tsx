"use client";

const Table = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-sm border-collapse">
        {children}
      </table>
    </div>
  );
};

export { Table };
