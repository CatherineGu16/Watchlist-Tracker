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
        {/* TMDB's API terms ask for its logo and this exact notice, less prominent than the app's own name. */}
        <footer className="flex flex-col items-start gap-1.5 px-1 pt-2 text-xs text-muted">
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" aria-label="TMDB">
            <img src={`${import.meta.env.BASE_URL}tmdb-logo.svg`} alt="TMDB" className="h-2.5 w-auto" />
          </a>
          <p>This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.</p>
        </footer>
      </div>
    </Sheet>
  )
}
