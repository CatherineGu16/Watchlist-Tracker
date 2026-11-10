import type { useActions } from '../ui/useActions.ts'
import { BackupPanel } from './BackupPanel.tsx'
import { GroupPlacement } from './GroupPlacement.tsx'
import { Sheet } from './Sheet.tsx'
import { SyncPanel } from './SyncPanel.tsx'
import { ThemePicker } from './ThemePicker.tsx'

export function Settings({
  open,
  onOpenChange,
  actions,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  actions: ReturnType<typeof useActions>
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Settings">
      <div className="mt-2 space-y-4">
        <SyncPanel />
        <GroupPlacement actions={actions} />
        <BackupPanel />
        <ThemePicker />
      </div>
    </Sheet>
  )
}
