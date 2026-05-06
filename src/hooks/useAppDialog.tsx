import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface AlertDialogState {
  type: 'alert'
  title?: string
  message: string
}

interface ConfirmDialogState {
  type: 'confirm'
  title?: string
  message: string
  confirmLabel: string
  variant: 'default' | 'destructive'
}

type DialogState = AlertDialogState | ConfirmDialogState

interface AppDialogContextValue {
  alert: (message: string, title?: string) => Promise<void>
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>
}

interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  variant?: 'default' | 'destructive'
}

const AppDialogContext = createContext<AppDialogContextValue | null>(null)

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const resolveRef = useRef<((value: unknown) => void) | null>(null)

  const alert = useCallback((message: string, title?: string) => {
    return new Promise<void>((resolve) => {
      resolveRef.current = resolve
      setDialog({ type: 'alert', message, title })
    })
  }, [])

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setDialog({
        type: 'confirm',
        message,
        title: options?.title,
        confirmLabel: options?.confirmLabel ?? 'Xác nhận',
        variant: options?.variant ?? 'default',
      })
    })
  }, [])

  const handleClose = useCallback(() => {
    setDialog(null)
    resolveRef.current?.(undefined)
    resolveRef.current = null
  }, [])

  const handleConfirm = useCallback((result: boolean) => {
    setDialog(null)
    resolveRef.current?.(result)
    resolveRef.current = null
  }, [])

  const value = useMemo(() => ({ alert, confirm }), [alert, confirm])

  return (
    <AppDialogContext.Provider value={value}>
      {children}

      {dialog?.type === 'alert' && (
        <AlertDialog open onOpenChange={() => handleClose()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{dialog.title ?? 'Thông báo'}</AlertDialogTitle>
              <AlertDialogDescription>{dialog.message}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleClose}>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {dialog?.type === 'confirm' && (
        <AlertDialog open onOpenChange={() => handleConfirm(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{dialog.title ?? 'Xác nhận'}</AlertDialogTitle>
              <AlertDialogDescription>{dialog.message}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => handleConfirm(false)}>
                Hủy
              </AlertDialogCancel>
              <AlertDialogAction
                className={dialog.variant === 'destructive' ? 'bg-ds-destructive text-ds-text-inverse hover:bg-ds-destructive/90' : undefined}
                onClick={() => handleConfirm(true)}
              >
                {dialog.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </AppDialogContext.Provider>
  )
}

export function useAppDialog(): AppDialogContextValue {
  const ctx = useContext(AppDialogContext)
  if (!ctx) throw new Error('useAppDialog must be used within AppDialogProvider')
  return ctx
}
