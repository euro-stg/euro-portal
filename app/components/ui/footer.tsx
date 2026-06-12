"use client";

const Footer = () => {
  return (
    <footer className="h-10 bg-white border-t border-slate-200 flex items-center justify-center">
      <p className="text-slate-400 text-xs">
        © {new Date().getFullYear()} Euromedica Group. All rights reserved.
      </p>
    </footer>
  );
};

export { Footer };
