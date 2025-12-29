import React, { useState } from "react";
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
import { Select } from "../../../shared/components/Select";
import type { ConnectionType } from "../types";

export function DevicesPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const devices = useAppSelector((state) => state.devices.devices);
  const connectedDeviceId = useAppSelector((state) => state.runtime.connectedDeviceId);
  const nextDeviceId = `DEV-${String(devices.length + 1).padStart(3, "0")}`;
  const [showAddModal, setShowAddModal] = useState(false);
  const [draftConnection, setDraftConnection] = useState<ConnectionType>("RS-485");

  const openAddModal = () => {
    setDraftConnection("RS-485");
    setShowAddModal(true);
  };

  const handleAddDevice = () => {
    dispatch(addDevice({ connection: draftConnection }));
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
    setShowAddModal(false);
  };

  return (
    <PageShell
      pageTitle="Devices"
      subtitle="Add and configure your devices"
      statusLeft={<Pill tone="neutral">Fleet</Pill>}
      right={
        <div className="flex items-center gap-3">
          <PrimaryButton
            onClick={openAddModal}
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
            const status =
              connectedDeviceId === device.id && device.configured
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
      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-neutral-900 p-6 shadow-xl ring-1 ring-white/10 text-left">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-slate-100">Add Device</div>
                <div className="mt-1 text-xs text-slate-400">
                  Configure line settings and connection type before adding a device.
                </div>
              </div>
              <button
                type="button"
                className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200"
                onClick={() => setShowAddModal(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="rounded-xl bg-neutral-950/60 p-4 ring-1 ring-white/10">
                <div className="text-xs font-extrabold text-slate-300">Connection Type</div>
                <div className="mt-3 space-y-3">
                  <Select
                    label="Connection:"
                    value={draftConnection}
                    onChange={(value) => setDraftConnection(value as ConnectionType)}
                    options={["RS-485", "TTL"]}
                    className="w-full"
                  />
                  <div className="rounded-lg bg-neutral-950/70 p-3 text-xs text-slate-400 ring-1 ring-white/10">
                    {draftConnection === "RS-485"
                      ? "RS-485 multi-drop bus with differential signaling."
                      : "TTL single-ended serial connection."}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <PrimaryButton
                variant="soft"
                className="cursor-pointer"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </PrimaryButton>
              <PrimaryButton className="cursor-pointer" onClick={handleAddDevice}>
                Add Device
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
