const EMOJIS = [
  '😀', '😂', '😊', '🙂', '😉', '😍', '🥰', '😘',
  '😎', '🤔', '😅', '😢', '😭', '😡', '👍', '👎',
  '🙏', '👏', '💪', '🤝', '✅', '❌', '⚠️', '❓',
  '❤️', '🔥', '⭐', '🎉', '📱', '🔧', '🛠️', '💰',
  '📦', '🚗', '⏰', '📅', '💬', '😴', '👋', '🙌',
]

export default function EmojiPicker({ onSelect, onClose }) {
  return (
    <div className="emoji-picker">
      <div className="emoji-picker-grid">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="emoji-picker-item"
            onClick={() => {
              onSelect(emoji)
              onClose()
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
