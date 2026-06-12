import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];

  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else if (currentPage <= 3) {
    pages.push(1, 2, 3, "...", totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push(1, "...", totalPages - 2, totalPages - 1, totalPages);
  } else {
    pages.push(1, "...", currentPage, "...", totalPages);
  }

  const btnBase = "h-8 w-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors";
  const btnInactive = `${btnBase} border border-slate-200 text-slate-600 hover:bg-slate-50`;
  const btnActive = `${btnBase} bg-slate-900 text-white`;
  const btnNav = `${btnBase} border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed`;

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-xs text-slate-400">Halaman {currentPage} dari {totalPages}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={btnNav}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pages.map((page, idx) =>
          page === "..." ? (
            <span key={`e-${idx}`} className="h-8 w-8 flex items-center justify-center text-slate-400 text-sm">
              ···
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={currentPage === page ? btnActive : btnInactive}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={btnNav}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
