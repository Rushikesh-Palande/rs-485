import React from "react";
import { Activity, Plus, Settings } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { addEvent } from "../../events/eventsSlice";
import { buildEvent } from "../../events/utils";
import { useNavigate } from "react-router-dom";
import { addDevice, setSelectedDeviceId } from "../devicesSlice";
import { Card } from "../../../shared/components/Card";
import { Pill } from "../../../shared/components/Pill";
import { PrimaryButton } from "../../../shared/components/PrimaryButton";
import { PageShell } from "../../ui/components/PageShell";

export function DevicesPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const devices = useAppSelector((state) => state.devices.devices);
  const selectedDeviceId = useAppSelector((state) => state.devices.selectedDeviceId);
  const connState = useAppSelector((state) => state.runtime.connState);
  const nextDeviceId = `DEV-${String(devices.length + 1).padStart(3, "0")}`;

  return (
    <PageShell
      pageTitle="Devices"
      subtitle="Add and configure your devices"
      statusLeft={<Pill tone="neutral">Fleet</Pill>}
      right={
        <div className="flex items-center gap-3">
          <PrimaryButton
            onClick={() => {
              dispatch(addDevice());
              dispatch(
                addEvent(
                  buildEvent({
                    deviceId: nextDeviceId,
                    type: "Device",
                    severity: "success",
                    message: `Device added (${nextDeviceId}).`,
                    source: "device",
                  })
                )
              );
            }}
            variant="soft"
            icon={<Plus className="h-4 w-4" />}
          >
            Add Device
          </PrimaryButton>
        </div>
      }
    >
      <Card title="Registered Devices">
        <div className="grid gap-4 md:grid-cols-2">
          {devices.map((device) => {
            const isSelected = device.id === selectedDeviceId;
            const status =
              isSelected && connState === "Connected" && device.configured
                ? "Connected"
                : "Disconnected";
            return (
              <div
                key={device.id}
                className="rounded-lg bg-neutral-950/60 p-5 ring-1 ring-white/10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-100">{device.name}</div>
                    <div className="text-xs text-slate-400">{device.id}</div>
                  </div>
                  <Pill tone={status === "Connected" ? "success" : "danger"}>
                    {status}
                  </Pill>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-400">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Connection
                    </div>
                    <div className="text-sm font-semibold text-slate-200">
                      {device.connection}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Last Seen
                    </div>
                    <div className="text-sm font-semibold text-slate-200">
                      {device.lastSeen}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <PrimaryButton
                    onClick={() => {
                      dispatch(setSelectedDeviceId(device.id));
                      navigate(`/devices/${device.id}/config`);
                    }}
                    icon={<Settings className="h-4 w-4" />}
                  >
                    Configure
                  </PrimaryButton>
                  <PrimaryButton
                    variant="soft"
                    onClick={() => {
                      dispatch(setSelectedDeviceId(device.id));
                      navigate(`/devices/${device.id}/monitor`);
                    }}
                    icon={<Activity className="h-4 w-4" />}
                  >
                    Monitor
                  </PrimaryButton>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </PageShell>
  );
}
