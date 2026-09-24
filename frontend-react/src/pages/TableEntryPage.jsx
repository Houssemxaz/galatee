import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useTableMode } from "@/context/TableModeContext";

export default function TableEntryPage() {
  const { activate } = useTableMode();
  useEffect(() => { activate(); }, [activate]);
  return <Navigate to="/menu" replace />;
}
