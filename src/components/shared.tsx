import React from "react";

export function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-gray-400 font-semibold uppercase mb-1"
      style={{ fontSize: 10, letterSpacing: "0.06em" }}
    >
      {children}
    </div>
  );
}

export function FG({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="text-gray-500 font-semibold uppercase mb-1"
        style={{ fontSize: 10, letterSpacing: "0.05em" }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
