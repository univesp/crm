import { nextTick, onBeforeUnmount, watch } from 'vue'

export function useDialogA11y(open, panelRef, close) {
  let triggerElement = null
  let listening = false

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
  }

  function startListening() {
    if (listening) return
    document.addEventListener('keydown', handleKeydown)
    listening = true
  }

  function stopListening() {
    if (!listening) return
    document.removeEventListener('keydown', handleKeydown)
    listening = false
  }

  function restoreFocus() {
    if (triggerElement && typeof triggerElement.focus === 'function') {
      triggerElement.focus()
    }
    triggerElement = null
  }

  watch(open, async (isOpen) => {
    if (isOpen) {
      triggerElement = document.activeElement
      await nextTick()
      panelRef.value?.focus()
      startListening()
    } else {
      stopListening()
      restoreFocus()
    }
  })

  onBeforeUnmount(() => {
    stopListening()
  })
}
