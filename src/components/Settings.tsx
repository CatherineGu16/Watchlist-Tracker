import { BackupPanel } from './BackupPanel.tsx'
import { Sheet } from './Sheet.tsx'
import { SyncPanel } from './SyncPanel.tsx'
import { ThemePicker } from './ThemePicker.tsx'

export function Settings({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Settings">
      <div className="mt-2 space-y-4">
        <SyncPanel />
        <BackupPanel />
        <ThemePicker />
      </div>
    </Sheet>
  )
}
