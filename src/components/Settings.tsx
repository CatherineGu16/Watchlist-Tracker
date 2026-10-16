import { BackupPanel } from './BackupPanel.tsx'
import { Sheet } from './Sheet.tsx'

export function Settings({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Settings">
      <div className="mt-2 space-y-4">
        <BackupPanel />
      </div>
    </Sheet>
  )
}
