import React from "react";
import { LayoutDashboard, Bell } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { setNav } from "../uiSlice";
import { cn } from "../../../shared/utils/cn";
import { IconButton } from "./IconButton";

export function Sidebar() {
  const dispatch = useAppDispatch();
  const nav = useAppSelector((state) => state.ui.nav);
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen border-r border-white/10 bg-neutral-900 transition-[width] duration-200",
        sidebarOpen ? "w-[220px]" : "w-[72px]"
      )}
    >
      <div
        className={cn(
          "flex h-full flex-col py-6",
          sidebarOpen ? "items-stretch px-2" : "items-center"
        )}
      >
        <div className={cn("flex flex-1 flex-col gap-3", sidebarOpen ? "items-stretch" : "items-center")}>
          <IconButton
            active={nav === "dash"}
            onClick={() => dispatch(setNav("dash"))}
            label="DEVICES"
            icon={<LayoutDashboard className="h-5 w-5" />}
            showLabel={sidebarOpen}
          />
          <IconButton
            active={nav === "events"}
            onClick={() => dispatch(setNav("events"))}
            label="EVENTS"
            icon={<Bell className="h-5 w-5" />}
            showLabel={sidebarOpen}
          />
        </div>

        <div className={cn("mt-4 flex flex-col gap-3", sidebarOpen ? "items-stretch" : "items-center")} />
      </div>
    </aside>
  );
}
