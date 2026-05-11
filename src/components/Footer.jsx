export function Footer({ onReset }) {
  return (
    <footer className="mt-16 pt-6 border-t border-stone-200 flex items-center justify-between text-xs text-stone-400">
      <div className="font-mono">data synced to cloud</div>
      <button onClick={onReset} className="hover:text-red-600 transition">
        reset all data
      </button>
    </footer>
  );
}

export function ResetModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.5)' }}>
      <div className="card rounded-2xl p-6 max-w-sm w-full">
        <h3 className="font-display text-xl mb-2" style={{ fontWeight: 500 }}>Reset everything?</h3>
        <p className="text-sm text-stone-600 mb-5">
          This will delete all your custom sentences and history from the cloud, and restore the starter set.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-sm hover:bg-stone-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-full text-sm bg-red-600 text-white hover:bg-red-700 transition"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
